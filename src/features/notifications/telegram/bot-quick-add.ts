import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { Category, TelegramConnection, Wallet } from '@/shared/types/domain';
import { createBotWalletTransaction } from '@/features/notifications/services/bot-quick-add-transaction';
import {
  resolveQuickAddPref,
  saveQuickAddPref,
} from '@/features/notifications/services/bot-quick-add-prefs';
import {
  saveUndoLast,
} from '@/features/notifications/services/bot-undo-transaction';
import {
  clearBotFlow,
  getConnectionByChatId,
  popMenu,
  pushMenu,
  setBotFlow,
} from '@/features/notifications/telegram/bot-nav';
import {
  BOT_QA_AMOUNT_PROMPT,
  BOT_QA_CONFIRM_PROMPT,
  BTN_QA_CANCEL,
  BTN_QA_EXPENSE,
  BTN_QA_INCOME,
  buildMainReplyKeyboard,
  buildQuickAddReplyKeyboard,
} from '@/features/notifications/telegram/telegram-keyboard';
import {
  MSG_ERROR_INVALID_AMOUNT,
  MSG_ERROR_NO_CATEGORIES,
  MSG_ERROR_NO_WALLETS,
  MSG_FLOW_CANCELLED,
  MSG_TX_SAVED,
} from '@/features/notifications/telegram/utils/telegram-copy';
import { formatTelegramMoney } from '@/features/notifications/telegram/utils/format-helpers';
import {
  answerTelegramCallback,
  editTelegramMessage,
  sendTelegramInlineMessage,
  sendTelegramMessage,
  type TelegramInlineMarkup,
} from '@/features/notifications/telegram/utils/telegram-client';

export type QuickAddFlow = {
  type: 'quick_add';
  step: 'type' | 'amount' | 'wallet' | 'category' | 'confirm';
  txType?: 'INCOME' | 'EXPENSE';
  amountToman?: number;
  walletId?: string;
  categoryId?: string;
  walletIds?: string[];
  categoryIds?: string[];
};

function parseFlow(raw: Record<string, unknown> | null): QuickAddFlow | null {
  if (!raw || raw.type !== 'quick_add') return null;
  return raw as unknown as QuickAddFlow;
}

function parseAmount(text: string): number | null {
  const normalized = text
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[,،_\s]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function truncate(text: string, max = 24): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

async function loadWallets(userId: string): Promise<Wallet[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('order_index', { ascending: true, nullsFirst: false });
  return (data ?? []) as Wallet[];
}

async function loadCategories(userId: string, kind: 'income' | 'expense'): Promise<Category[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', kind)
    .order('order_index', { ascending: true, nullsFirst: false });
  return (data ?? []) as Category[];
}

function walletInlineKeyboard(wallets: Wallet[]): TelegramInlineMarkup {
  const rows = wallets.slice(0, 12).map((wallet, index) => [
    { text: truncate(wallet.name), callback_data: `qa:w:${index}` },
  ]);
  rows.push([{ text: '❌ لغو', callback_data: 'qa:cancel' }]);
  return { inline_keyboard: rows };
}

function categoryInlineKeyboard(categories: Category[]): TelegramInlineMarkup {
  const rows = categories.slice(0, 12).map((category, index) => [
    { text: truncate(category.name), callback_data: `qa:c:${index}` },
  ]);
  rows.push([{ text: '❌ لغو', callback_data: 'qa:cancel' }]);
  return { inline_keyboard: rows };
}

function confirmInlineKeyboard(showChange: boolean): TelegramInlineMarkup {
  const rows: TelegramInlineMarkup['inline_keyboard'] = [
    [
      { text: '✅ ثبت', callback_data: 'qa:yes' },
      { text: '❌ لغو', callback_data: 'qa:cancel' },
    ],
  ];
  if (showChange) {
    rows.unshift([{ text: '🔄 تغییر کیف/دسته', callback_data: 'qa:change' }]);
  }
  return { inline_keyboard: rows };
}

async function loadWalletName(userId: string, walletId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('wallets')
    .select('name')
    .eq('user_id', userId)
    .eq('id', walletId)
    .maybeSingle();
  return (data as { name?: string } | null)?.name ?? null;
}

async function loadCategoryName(userId: string, categoryId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('categories')
    .select('name')
    .eq('user_id', userId)
    .eq('id', categoryId)
    .maybeSingle();
  return (data as { name?: string } | null)?.name ?? null;
}

async function buildConfirmText(
  flow: QuickAddFlow,
  userId: string,
  usedLastPref: boolean
): Promise<string> {
  const lines = [
    BOT_QA_CONFIRM_PROMPT,
    '',
    flow.txType === 'INCOME' ? '💚 درآمد' : '🔴 هزینه',
    `💰 ${formatTelegramMoney(flow.amountToman ?? 0, 'TOMAN')}`,
  ];
  if (flow.walletId && flow.categoryId) {
    const [walletName, categoryName] = await Promise.all([
      loadWalletName(userId, flow.walletId),
      loadCategoryName(userId, flow.categoryId),
    ]);
    if (walletName) lines.push(`👛 ${walletName}`);
    if (categoryName) lines.push(`🏷 ${categoryName}`);
  }
  if (usedLastPref) {
    lines.push('', '⚡ کیف و دسته از آخرین ثبت');
  }
  return lines.join('\n');
}

async function promptConfirm(
  chatId: number,
  connection: TelegramConnection,
  flow: QuickAddFlow,
  messageId: number | undefined,
  usedLastPref: boolean
): Promise<void> {
  const text = await buildConfirmText(flow, connection.user_id, usedLastPref);
  await editOrSendInline(chatId, messageId, text, confirmInlineKeyboard(usedLastPref));
}

async function proceedAfterAmount(
  chatId: number,
  connection: TelegramConnection,
  flow: QuickAddFlow,
  amount: number,
  messageId?: number
): Promise<void> {
  if (!flow.txType) return;

  const pref = await resolveQuickAddPref(connection.user_id, flow.txType);
  if (pref) {
    const next: QuickAddFlow = {
      ...flow,
      step: 'confirm',
      amountToman: amount,
      walletId: pref.walletId,
      categoryId: pref.categoryId,
    };
    await setBotFlow(chatId, next);
    await promptConfirm(chatId, connection, next, messageId, true);
    return;
  }

  const wallets = await loadWallets(connection.user_id);
  if (wallets.length === 0) {
    await sendTelegramMessage(chatId, MSG_ERROR_NO_WALLETS, buildQuickAddReplyKeyboard());
    return;
  }

  const next: QuickAddFlow = {
    ...flow,
    step: 'wallet',
    amountToman: amount,
    walletIds: wallets.map((w) => w.id),
  };
  await setBotFlow(chatId, next);
  await sendTelegramInlineMessage(
    chatId,
    `👛 کیف پول را انتخاب کنید\n💰 ${formatTelegramMoney(amount, 'TOMAN')}`,
    walletInlineKeyboard(wallets)
  );
}
async function editOrSendInline(
  chatId: number,
  messageId: number | undefined,
  text: string,
  markup: TelegramInlineMarkup
): Promise<void> {
  if (messageId) {
    try {
      await editTelegramMessage(chatId, messageId, text, markup);
      return;
    } catch {
      // Fall back to a new message if the inline message can't be edited.
    }
  }
  await sendTelegramInlineMessage(chatId, text, markup);
}

export async function startQuickAddFlow(chatId: number): Promise<void> {
  await pushMenu(chatId, 'quick_add');
  await setBotFlow(chatId, { type: 'quick_add', step: 'type' });
  await sendTelegramMessage(chatId, '⚡ نوع تراکنش را انتخاب کنید:', buildQuickAddReplyKeyboard());
}

export async function cancelQuickAddFlow(chatId: number): Promise<void> {
  await clearBotFlow(chatId);
  await popMenu(chatId);
  await sendTelegramMessage(chatId, MSG_FLOW_CANCELLED, buildMainReplyKeyboard());
}

export async function handleQuickAddMessage(
  chatId: number,
  text: string,
  connection: TelegramConnection,
  flow: QuickAddFlow
): Promise<boolean> {
  if (text === BTN_QA_CANCEL) {
    await cancelQuickAddFlow(chatId);
    return true;
  }

  if (flow.step === 'type') {
    if (text === BTN_QA_INCOME) {
      await setBotFlow(chatId, { ...flow, step: 'amount', txType: 'INCOME' });
      await sendTelegramMessage(chatId, BOT_QA_AMOUNT_PROMPT, buildQuickAddReplyKeyboard());
      return true;
    }
    if (text === BTN_QA_EXPENSE) {
      await setBotFlow(chatId, { ...flow, step: 'amount', txType: 'EXPENSE' });
      await sendTelegramMessage(chatId, BOT_QA_AMOUNT_PROMPT, buildQuickAddReplyKeyboard());
      return true;
    }
    return true;
  }

  if (flow.step === 'amount') {
    const amount = parseAmount(text);
    if (!amount) {
      await sendTelegramMessage(chatId, MSG_ERROR_INVALID_AMOUNT, buildQuickAddReplyKeyboard());
      return true;
    }

    await proceedAfterAmount(chatId, connection, flow, amount);
    return true;
  }

  return false;
}

export async function handleQuickAddCallback(
  chatId: number,
  data: string,
  connection: TelegramConnection,
  callbackQueryId: string,
  messageId?: number
): Promise<boolean> {
  if (!data.startsWith('qa:')) return false;

  const fresh = await getConnectionByChatId(chatId);
  const flow = parseFlow((fresh?.bot_flow as Record<string, unknown> | null) ?? null);
  if (!flow || flow.type !== 'quick_add') {
    await answerTelegramCallback(callbackQueryId, 'جلسه منقضی شد.');
    return true;
  }

  if (data === 'qa:cancel') {
    await answerTelegramCallback(callbackQueryId);
    await cancelQuickAddFlow(chatId);
    return true;
  }

  if (data === 'qa:change') {
    if (!flow.txType || !flow.amountToman) {
      await answerTelegramCallback(callbackQueryId, 'اطلاعات ناقص است.');
      return true;
    }
    const wallets = await loadWallets(connection.user_id);
    if (wallets.length === 0) {
      await answerTelegramCallback(callbackQueryId, MSG_ERROR_NO_WALLETS);
      return true;
    }
    const next: QuickAddFlow = {
      ...flow,
      step: 'wallet',
      walletId: undefined,
      categoryId: undefined,
      walletIds: wallets.map((w) => w.id),
      categoryIds: undefined,
    };
    await setBotFlow(chatId, next);
    await answerTelegramCallback(callbackQueryId);
    await editOrSendInline(
      chatId,
      messageId,
      `👛 کیف پول را انتخاب کنید\n💰 ${formatTelegramMoney(flow.amountToman, 'TOMAN')}`,
      walletInlineKeyboard(wallets)
    );
    return true;
  }

  if (data === 'qa:yes') {
    if (!flow.txType || !flow.amountToman || !flow.walletId || !flow.categoryId) {
      await answerTelegramCallback(callbackQueryId, 'اطلاعات ناقص است.');
      return true;
    }
    const result = await createBotWalletTransaction({
      userId: connection.user_id,
      type: flow.txType,
      amountToman: flow.amountToman,
      walletId: flow.walletId,
      categoryId: flow.categoryId,
    });
    await answerTelegramCallback(callbackQueryId, result.ok ? MSG_TX_SAVED : result.error);
    if (messageId) {
      await editTelegramMessage(
        chatId,
        messageId,
        result.ok ? `✅ ${MSG_TX_SAVED}` : `❌ ${result.error}`
      );
    }
    if (result.ok) {
      await saveQuickAddPref(connection.user_id, flow.txType, {
        walletId: flow.walletId,
        categoryId: flow.categoryId,
      });
      await saveUndoLast(connection.user_id, result.transactionId);
      await sendTelegramInlineMessage(chatId, 'تا ۵ دقیقه می‌توانید این ثبت را لغو کنید:', {
        inline_keyboard: [[{ text: '↩️ لغو ثبت', callback_data: 'undo:last' }]],
      });
    }
    await cancelQuickAddFlow(chatId);
    return true;
  }

  if (data.startsWith('qa:w:')) {
    const index = Number(data.slice(5));
    const walletId = flow.walletIds?.[index];
    if (!walletId || !flow.txType) {
      await answerTelegramCallback(callbackQueryId, 'کیف پول نامعتبر.');
      return true;
    }

    const kind = flow.txType === 'INCOME' ? 'income' : 'expense';
    const categories = await loadCategories(connection.user_id, kind);
    if (categories.length === 0) {
      await answerTelegramCallback(callbackQueryId, MSG_ERROR_NO_CATEGORIES);
      return true;
    }

    const next: QuickAddFlow = {
      ...flow,
      step: 'category',
      walletId,
      categoryIds: categories.map((c) => c.id),
    };
    await setBotFlow(chatId, next);
    await answerTelegramCallback(callbackQueryId);
    await editOrSendInline(
      chatId,
      messageId,
      '🏷 دسته‌بندی را انتخاب کنید:',
      categoryInlineKeyboard(categories)
    );
    return true;
  }

  if (data.startsWith('qa:c:')) {
    const index = Number(data.slice(5));
    const categoryId = flow.categoryIds?.[index];
    if (!categoryId || !flow.txType || !flow.amountToman || !flow.walletId) {
      await answerTelegramCallback(callbackQueryId, 'دسته نامعتبر.');
      return true;
    }

    const next: QuickAddFlow = {
      ...flow,
      step: 'confirm',
      categoryId,
    };
    await setBotFlow(chatId, next);
    await answerTelegramCallback(callbackQueryId);
    await promptConfirm(chatId, connection, next, messageId, false);
    return true;
  }

  return false;
}

export function isQuickAddActive(flow: Record<string, unknown> | null): boolean {
  return parseFlow(flow)?.type === 'quick_add';
}
