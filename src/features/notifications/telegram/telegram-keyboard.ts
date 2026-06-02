import type { TelegramReplyMarkup } from '@/features/notifications/telegram/utils/telegram-client';

/** Main menu */
export const BTN_TODAY_CASHFLOW = '📊 درآمد و هزینه امروز';
export const BTN_MENU_REPORTS = '📋 گزارش‌ها';
export const BTN_MENU_PRICES = '💰 قیمت‌ها';

/** Reports submenu */
export const BTN_PORTFOLIO = '💼 ارزش پرتفوی';
export const BTN_MONTH_DEBTS = '📅 اقساط این ماه';

/** Prices submenu */
export const BTN_UPDATE_PRICES = '🔄 بروزرسانی قیمت‌ها';
export const BTN_GET_PRICES = '📈 مشاهده قیمت‌ها';

export const BTN_BACK = '🔙 بازگشت';

export const ALL_BOT_BUTTONS = new Set([
  BTN_TODAY_CASHFLOW,
  BTN_MENU_REPORTS,
  BTN_MENU_PRICES,
  BTN_PORTFOLIO,
  BTN_MONTH_DEBTS,
  BTN_UPDATE_PRICES,
  BTN_GET_PRICES,
  BTN_BACK,
]);

export function buildMainReplyKeyboard(): TelegramReplyMarkup {
  return {
    keyboard: [
      [{ text: BTN_TODAY_CASHFLOW }],
      [{ text: BTN_MENU_REPORTS }, { text: BTN_MENU_PRICES }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'منو را انتخاب کنید',
  };
}

export function buildReportsReplyKeyboard(): TelegramReplyMarkup {
  return {
    keyboard: [[{ text: BTN_PORTFOLIO }, { text: BTN_MONTH_DEBTS }], [{ text: BTN_BACK }]],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'گزارش را انتخاب کنید',
  };
}

export function buildPricesReplyKeyboard(): TelegramReplyMarkup {
  return {
    keyboard: [[{ text: BTN_UPDATE_PRICES }, { text: BTN_GET_PRICES }], [{ text: BTN_BACK }]],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'عملیات قیمت',
  };
}

export const BOT_WELCOME_LINKED = `👋 به خرجوک خوش آمدید!

از منوی زیر استفاده کنید:
• درآمد/هزینه امروز
• گزارش‌ها (پرتفوی، اقساط ماه)
• قیمت‌ها (بروزرسانی و مشاهده)

⏰ یادآور قسط‌های امروز ساعت ۹ صبح — از تنظیمات اپ.`;

export const BOT_WELCOME_UNLINKED = `👋 سلام!

برای استفاده از بات، ابتدا از تنظیمات اپ «اتصال تلگرام» را بزنید.`;

export const BOT_LINKED_SUCCESS = '✅ اتصال برقرار شد!';

export const BOT_REPORTS_MENU_HINT = '📋 یک گزارش انتخاب کنید:';
export const BOT_PRICES_MENU_HINT = '💰 عملیات قیمت:';
