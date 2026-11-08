import type { ReactNode } from 'react';
import {
  Banknote, Bus, Coffee, CreditCard, FileText, Gift, HeartPulse, Home, Receipt, Shirt, ShoppingCart, TrendingUp, Utensils, Wallet, Zap,
} from '@/design-system/icons';

/**
 * Icon for a category by its Persian name. Categories have no icon field
 * in the database; this keeps tiles recognizable without a migration.
 */
const RULES: [RegExp, ReactNode][] = [
  [/کافه|قهوه|کافی/, <Coffee key="c" />],
  [/خوراک|غذا|رستوران|ناهار|شام|صبحانه|فست/, <Utensils key="u" />],
  [/سوپر|خرید|بازار|میوه|مارکت/, <ShoppingCart key="s" />],
  [/حمل|تاکسی|اسنپ|بنزین|ماشین|خودرو|مترو|اتوبوس|سفر/, <Bus key="b" />],
  [/خانه|اجاره|رهن|منزل|مسکن/, <Home key="h" />],
  [/قبض|برق|آب|گاز|اینترنت|موبایل|شارژ|تلفن/, <Zap key="z" />],
  [/سلامت|دارو|پزشک|دکتر|بیمه|درمان/, <HeartPulse key="p" />],
  [/پوشاک|لباس|کفش/, <Shirt key="t" />],
  [/هدیه|کادو/, <Gift key="g" />],
  [/حقوق|دستمزد|درآمد|پاداش/, <Banknote key="n" />],
  [/سود|بهره|سرمایه/, <TrendingUp key="r" />],
  [/قسط|وام|بدهی|کارت/, <CreditCard key="k" />],
  [/اشتراک|سرویس/, <Receipt key="e" />],
  [/پس.?انداز|کیف/, <Wallet key="w" />],
];

export function categoryIcon(name: string): ReactNode {
  for (const [re, icon] of RULES) if (re.test(name)) return icon;
  return <FileText />;
}
