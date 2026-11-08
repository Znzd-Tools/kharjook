/**
 * Kharjook icon set — Solar icons (rounded, friendly).
 *
 * Import icons ONLY from '@/design-system/icons'. The names stay generic
 * (Wallet, Home, Plus…) so the pack can change later in one file.
 *
 * Styles:
 * - `bold-duotone`: entity, navigation and status icons (soft, cute).
 * - `linear`: small UI glyphs (close, check, arrows, chevrons).
 *
 * RTL: "back" is ArrowRight, "forward" / list chevron is ChevronLeft.
 */
import * as D from '@solar-icons/react/bold-duotone';
import * as L from '@solar-icons/react/linear';

export type IconComponent = typeof L.CloseIcon;

/* UI glyphs (linear) */
export const X = L.CloseIcon;
export const Check = L.CheckIcon;
export const Plus = L.AddIcon;
export const Minus = L.MinusIcon;
export const ChevronDown = L.AltArrowDownIcon;
export const ChevronLeft = L.AltArrowLeftIcon;
export const ChevronRight = L.AltArrowRightIcon;
export const ArrowLeft = L.ArrowLeftIcon;
export const ArrowRight = L.ArrowRightIcon;
export const ArrowUpLeft = L.ArrowLeftUpIcon;
export const ArrowDownLeft = L.ArrowLeftDownIcon;
export const Search = L.RoundedMagnifierIcon;
export const MoreHorizontal = L.MenuDotsIcon;

/* Status (bold duotone) */
export const Info = D.InfoCircleIcon;
export const CheckCircle2 = D.CheckCircleIcon;
export const XCircle = D.CloseCircleIcon;
export const AlertTriangle = D.DangerTriangleIcon;
export const Delete = D.BackspaceIcon;

/* Navigation and actions (bold duotone) */
export const Home = D.HomeSmileIcon;
export const Receipt = D.BillListIcon;
export const PieChart = D.PieChart2Icon;
export const CalendarDays = D.CalendarIcon;
export const Settings = D.SettingsIcon;
export const Bell = D.BellIcon;
export const Eye = D.EyeIcon;
export const EyeOff = D.EyeClosedIcon;
export const Pencil = D.Pen2Icon;
export const Copy = D.CopyIcon;
export const Trash2 = D.TrashBinMinimalisticIcon;
export const RefreshCw = D.RefreshIcon;
export const Repeat = D.RepeatIcon;
export const Download = D.DownloadMinimalisticIcon;
export const LayoutGrid = D.Widget4Icon;
export const Clock = D.ClockCircleIcon;
export const Lightbulb = D.LightbulbIcon;
export const Percent = D.SaleIcon;
export const Target = D.TargetIcon;
export const Users = D.UsersGroupRoundedIcon;
export const TrendingUp = D.GraphUpIcon;
export const BarChart3 = D.ChartIcon;
export const ArrowLeftRight = D.TransferHorizontalIcon;

/* Money and entities (bold duotone) */
export const Wallet = D.WalletIcon;
export const Landmark = D.Buildings2Icon;
export const Coins = D.MoneyBagIcon;
export const CreditCard = D.CardIcon;
export const Banknote = D.BanknoteIcon;
export const CircleDollarSign = D.DollarIcon;
export const FileText = D.DocumentTextIcon;

/* Categories (bold duotone) */
export const Utensils = D.ChefHatIcon;
export const ShoppingCart = D.Cart3Icon;
export const Bus = D.BusIcon;
export const Coffee = D.CupHotIcon;
export const Zap = D.BoltIcon;
export const Gift = D.GiftIcon;
export const HeartPulse = D.HeartPulseIcon;
export const Shirt = D.TShirtIcon;
