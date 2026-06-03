export const MSG_LOADING_CALC = '⏳ در حال محاسبه...';
export const MSG_LOADING_FETCH = '⏳ در حال بارگذاری...';
export const MSG_LOADING_PRICES =
  '⏳ در حال بروزرسانی قیمت‌ها...\nممکن است چند ثانیه طول بکشد.';

export const MSG_MAIN_MENU = 'منوی اصلی 👇';
export const MSG_USE_MENU = 'از منوی زیر استفاده کنید 👇';

export const MSG_ERROR_GENERIC = '❌ خطا رخ داد. دوباره تلاش کنید.';
export const MSG_ERROR_SETTLE = '❌ تسویه قسط ناموفق بود.';
export const MSG_ERROR_SAVE = '❌ ذخیره نشد. دوباره تلاش کنید.';
export const MSG_ERROR_INVALID_AMOUNT = '❌ مبلغ نامعتبر است. فقط عدد وارد کنید.';
export const MSG_ERROR_NO_WALLETS = '❌ کیف پول فعالی ندارید. ابتدا در اپ بسازید.';
export const MSG_ERROR_NO_CATEGORIES = '❌ دسته‌بندی مناسب ندارید. ابتدا در اپ بسازید.';

export function msgErrorDetail(detail: string): string {
  return `❌ ${detail}`;
}

export function msgPriceRefreshFailed(detail: string): string {
  return `❌ بروزرسانی قیمت‌ها ناموفق بود.\n${detail}`;
}

export const MSG_SETTLE_OK = '✅ قسط تسویه شد و تراکنش ثبت شد.';
export const MSG_SETTLE_ALREADY = 'ℹ️ این قسط قبلاً پرداخت شده.';
export const MSG_TX_SAVED = '✅ تراکنش ثبت شد.';
export const MSG_TX_UNDONE = '↩️ آخرین تراکنش حذف شد.';
export const MSG_TX_UNDO_EXPIRED = 'مهلت لغو تمام شده.';
export const MSG_FLOW_CANCELLED = '❌ عملیات لغو شد.';
export const MSG_SETTINGS_SAVED = '✅ تنظیمات ذخیره شد.';
