import { settleLoanInstallment } from '@/features/deadlines/services/settle-loan-installment';
import { isAssetLoan } from '@/features/deadlines/utils/loan-amount';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { Loan, LoanInstallment, TelegramConnection, Wallet } from '@/shared/types/domain';
import {
  answerTelegramCallback,
  editTelegramMessage,
  sendTelegramInlineMessage,
  type TelegramInlineMarkup,
} from '@/features/notifications/telegram/utils/telegram-client';
import { sendTelegramMessage } from '@/features/notifications/telegram/utils/telegram-client';

/*
 * The Telegram bot only sends notifications and reminders (Ali, 1405/08).
 * Kept here: linking (/start <token>, in the webhook) and the «پرداخت»
 * button on installment reminders. Every other message gets BOT_ONLY_NOTIFY.
 */

export const MSG_SETTLE_OK = '✅ قسط تسویه شد و تراکنش ثبت شد.';
export const MSG_SETTLE_ALREADY = 'ℹ️ این قسط قبلاً پرداخت شده.';
export const BOT_LINKED = `✅ اتصال برقرار شد!

از این به بعد یادآوری چک، قسط و اشتراک و اعلان‌هایی که در اپ روشن کرده‌ای اینجا می‌آید.
تنظیم اعلان‌ها: اپ ← تنظیمات ← اعلان‌ها.`;
export const BOT_UNLINKED = `👋 سلام!

این ربات اعلان‌ها و یادآوری‌های خرجوک را می‌فرستد. برای وصل شدن، در اپ به تنظیمات ← اعلان‌ها ← «اتصال تلگرام» برو.`;
export const BOT_ONLY_NOTIFY = 'ℹ️ این ربات فقط اعلان‌ها و یادآوری‌ها را می‌فرستد. برای ثبت تراکنش یا تغییر تنظیمات از اپ استفاده کن.';

export async function getConnectionByChatId(chatId: number): Promise<TelegramConnection | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('telegram_connections')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true)
    .maybeSingle();
  return (data as TelegramConnection | null) ?? null;
}

async function setBotFlow(chatId: number, flow: Record<string, unknown> | null): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('telegram_connections')
    .update({ bot_flow: flow })
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true);
  if (error) throw new Error(`bot_flow update failed: ${error.message}`);
}

const clearBotFlow = (chatId: number) => setBotFlow(chatId, null);

/** Any text that is not /start: the bot has no menus. */
export async function handleBotText(chatId: number): Promise<void> {
  const connection = await getConnectionByChatId(chatId);
  await sendTelegramMessage(chatId, connection ? BOT_ONLY_NOTIFY : BOT_UNLINKED);
}

type PayInstallmentFlow = {
  type: 'pay_installment';
  installmentId: string;
  walletIds: string[];
};

function truncate(text: string, max = 24): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

async function loadActiveWallets(userId: string): Promise<Wallet[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('order_index', { ascending: true, nullsFirst: false });
  return (data ?? []) as Wallet[];
}

async function loadLoanForInstallment(
  userId: string,
  installmentId: string
): Promise<Loan | null> {
  const admin = createSupabaseAdminClient();
  const { data: installmentRow } = await admin
    .from('loan_installments')
    .select('loan_id')
    .eq('id', installmentId)
    .eq('user_id', userId)
    .maybeSingle();
  const installment = installmentRow as Pick<LoanInstallment, 'loan_id'> | null;
  if (!installment) return null;
  const { data: loanRow } = await admin
    .from('loans')
    .select('*')
    .eq('id', installment.loan_id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  return (loanRow as Loan | null) ?? null;
}

function walletPickKeyboard(wallets: Wallet[]): TelegramInlineMarkup {
  const rows = wallets.slice(0, 8).map((wallet, index) => [
    { text: truncate(wallet.name), callback_data: `pw:${index}` },
  ]);
  rows.push([{ text: '❌ لغو', callback_data: 'pw:cancel' }]);
  return { inline_keyboard: rows };
}

async function answerSettleResult(
  chatId: number,
  callbackQueryId: string,
  result: Awaited<ReturnType<typeof settleLoanInstallment>>,
  messageId?: number
): Promise<void> {
  if (result.ok) {
    await answerTelegramCallback(callbackQueryId, MSG_SETTLE_OK);
    if (messageId) {
      await editTelegramMessage(chatId, messageId, `✅ ${MSG_SETTLE_OK}`);
    }
    return;
  }
  await answerTelegramCallback(
    callbackQueryId,
    result.code === 'already_paid' ? MSG_SETTLE_ALREADY : result.error
  );
}

async function handlePayInstallmentStart(
  chatId: number,
  connection: TelegramConnection,
  installmentId: string,
  callbackQueryId: string,
  messageId?: number
): Promise<void> {
  const loan = await loadLoanForInstallment(connection.user_id, installmentId);
  if (!loan) {
    await answerTelegramCallback(callbackQueryId, 'قسط پیدا نشد.');
    return;
  }

  // Asset loans settle against the loan asset — no wallet pick.
  if (isAssetLoan(loan)) {
    const result = await settleLoanInstallment({
      userId: connection.user_id,
      installmentId,
    });
    await answerSettleResult(chatId, callbackQueryId, result, messageId);
    return;
  }

  const wallets = await loadActiveWallets(connection.user_id);
  if (wallets.length === 0) {
    await answerTelegramCallback(callbackQueryId, 'کیف پول فعالی ندارید.');
    return;
  }

  if (wallets.length === 1) {
    const result = await settleLoanInstallment({
      userId: connection.user_id,
      installmentId,
      walletId: wallets[0]!.id,
    });
    await answerSettleResult(chatId, callbackQueryId, result, messageId);
    return;
  }

  await setBotFlow(chatId, {
    type: 'pay_installment',
    installmentId,
    walletIds: wallets.map((w) => w.id),
  });

  await answerTelegramCallback(callbackQueryId);
  const text = '👛 کیف پول پرداخت را انتخاب کنید:';
  if (messageId) {
    await editTelegramMessage(chatId, messageId, text, walletPickKeyboard(wallets));
  } else {
    await sendTelegramInlineMessage(chatId, text, walletPickKeyboard(wallets));
  }
}

async function handlePayWalletPick(
  chatId: number,
  connection: TelegramConnection,
  walletIndex: number,
  callbackQueryId: string,
  messageId?: number
): Promise<void> {
  const flow = connection.bot_flow as PayInstallmentFlow | null;
  if (!flow || flow.type !== 'pay_installment') {
    await answerTelegramCallback(callbackQueryId, 'جلسه منقضی شد.');
    return;
  }

  const walletId = flow.walletIds[walletIndex];
  if (!walletId) {
    await answerTelegramCallback(callbackQueryId, 'کیف پول نامعتبر.');
    return;
  }

  const result = await settleLoanInstallment({
    userId: connection.user_id,
    installmentId: flow.installmentId,
    walletId,
  });

  await clearBotFlow(chatId);

  if (result.ok) {
    await answerTelegramCallback(callbackQueryId, MSG_SETTLE_OK);
    if (messageId) {
      await editTelegramMessage(chatId, messageId, `✅ ${MSG_SETTLE_OK}`);
    }
    return;
  }

  await answerTelegramCallback(
    callbackQueryId,
    result.code === 'already_paid' ? MSG_SETTLE_ALREADY : result.error
  );
}

export async function handleBotCallback(input: {
  chatId: number;
  data: string;
  callbackQueryId: string;
  messageId?: number;
}): Promise<void> {
  const connection = await getConnectionByChatId(input.chatId);
  if (!connection) {
    await answerTelegramCallback(input.callbackQueryId, 'ابتدا از اپ وصل شوید.');
    return;
  }
  const { data, callbackQueryId, chatId, messageId } = input;

  if (data.startsWith('pi:')) {
    await handlePayInstallmentStart(chatId, connection, data.slice(3), callbackQueryId, messageId);
    return;
  }
  if (data === 'pw:cancel') {
    await clearBotFlow(chatId);
    await answerTelegramCallback(callbackQueryId, 'لغو شد.');
    if (messageId) await editTelegramMessage(chatId, messageId, '❌ پرداخت لغو شد.');
    return;
  }
  if (data.startsWith('pw:')) {
    const fresh = await getConnectionByChatId(chatId);
    if (!fresh) return;
    await handlePayWalletPick(chatId, fresh, Number(data.slice(3)), callbackQueryId, messageId);
    return;
  }
  // Buttons from old menus (removed features).
  await answerTelegramCallback(callbackQueryId, 'این گزینه دیگر وجود ندارد.');
}
