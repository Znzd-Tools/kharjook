import type {
  Check,
  CurrencyRate,
  ExpensePlanItem,
  ExpensePlanSourceType,
  Loan,
  LoanInstallment,
  RecurringTransaction,
  Subscription,
} from '@/shared/types/domain';
import { installmentRemainingAmount } from '@/features/deadlines/utils/installment-remaining';
import {
  recurringDueDatesInPeriod,
  subscriptionDueDatesInPeriod,
} from '@/features/plan/utils/recurring-due-in-period';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import type { Period } from '@/shared/utils/period';

export type PlanSuggestion = {
  key: string;
  sourceType: Exclude<ExpensePlanSourceType, 'manual'>;
  sourceId: string;
  title: string;
  subtitle: string | null;
  amountToman: number;
  categoryId: string | null;
  note: string | null;
};

function amountInCurrencyToToman(
  amount: number,
  currency: Loan['currency'] | Check['currency'] | Subscription['currency'],
  currencyRates: CurrencyRate[]
): number {
  const rate = tomanPerUnit(currency, currencyRates);
  if (!(rate > 0)) return 0;
  return amount * rate;
}

function isSuggestionAlreadyAdded(
  items: ExpensePlanItem[],
  sourceType: ExpensePlanSourceType,
  sourceId: string
): boolean {
  return items.some(
    (item) => item.source_type === sourceType && item.source_id === sourceId
  );
}

export function buildPlanSuggestions(input: {
  period: Period;
  items: ExpensePlanItem[];
  installments: LoanInstallment[];
  loans: Loan[];
  checks: Check[];
  recurring: RecurringTransaction[];
  subscriptions: Subscription[];
  currencyRates: CurrencyRate[];
}): PlanSuggestion[] {
  const { period, items, installments, loans, checks, recurring, subscriptions, currencyRates } =
    input;
  const loansById = new Map(loans.map((loan) => [loan.id, loan]));
  const installmentSuggestions: Array<{ dueDate: string; suggestion: PlanSuggestion }> = [];
  const out: PlanSuggestion[] = [];

  for (const installment of installments) {
    if (installment.is_paid) continue;
    const remaining = installmentRemainingAmount(installment);
    if (remaining <= 0) continue;

    const loan = loansById.get(installment.loan_id);
    if (!loan) continue;
    if (isSuggestionAlreadyAdded(items, 'installment', installment.id)) continue;

    const amountToman = amountInCurrencyToToman(remaining, loan.currency, currencyRates);
    if (amountToman <= 0) continue;

    installmentSuggestions.push({
      dueDate: installment.due_date_string,
      suggestion: {
        key: `installment:${installment.id}`,
        sourceType: 'installment',
        sourceId: installment.id,
        title: loan.title,
        subtitle: `قسط ${installment.sequence_no} · ${installment.due_date_string}`,
        amountToman,
        categoryId: loan.category_id,
        note: installment.note,
      },
    });
  }

  for (const check of checks) {
    if (check.status !== 'pending' || check.deleted_at) continue;
    if (isSuggestionAlreadyAdded(items, 'check', check.id)) continue;

    const amountToman = amountInCurrencyToToman(check.amount, check.currency, currencyRates);
    if (amountToman <= 0) continue;

    out.push({
      key: `check:${check.id}`,
      sourceType: 'check',
      sourceId: check.id,
      title: check.title,
      subtitle: check.due_date_string,
      amountToman,
      categoryId: check.category_id,
      note: check.note,
    });
  }

  for (const row of recurring) {
    if (row.type !== 'EXPENSE') continue;
    const dueDates = recurringDueDatesInPeriod(row, period);
    if (dueDates.length === 0) continue;
    if (isSuggestionAlreadyAdded(items, 'recurring', row.id)) continue;

    const amountToman = Number(row.amount_toman) * dueDates.length;
    if (amountToman <= 0) continue;

    const dueLabel =
      dueDates.length === 1
        ? dueDates[0]!
        : `${dueDates.length} بار در این ماه`;

    out.push({
      key: `recurring:${row.id}`,
      sourceType: 'recurring',
      sourceId: row.id,
      title: row.title,
      subtitle: dueLabel,
      amountToman,
      categoryId: row.category_id,
      note: row.note,
    });
  }

  for (const row of subscriptions) {
    if (row.status !== 'active' || row.deleted_at) continue;
    const dueDates = subscriptionDueDatesInPeriod(row, period);
    if (dueDates.length === 0) continue;
    if (isSuggestionAlreadyAdded(items, 'subscription', row.id)) continue;

    const amountToman = amountInCurrencyToToman(row.amount, row.currency, currencyRates) * dueDates.length;
    if (amountToman <= 0) continue;

    const dueLabel =
      dueDates.length === 1 ? dueDates[0]! : `${dueDates.length} بار در این ماه`;

    out.push({
      key: `subscription:${row.id}`,
      sourceType: 'subscription',
      sourceId: row.id,
      title: row.platform,
      subtitle: dueLabel,
      amountToman,
      categoryId: row.category_id,
      note: row.note,
    });
  }

  const sortedInstallments = installmentSuggestions
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((row) => row.suggestion);

  const nonInstallments = out.sort((a, b) => b.amountToman - a.amountToman);
  return [...sortedInstallments, ...nonInstallments];
}

export function planItemsTotalToman(items: ExpensePlanItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.amount_toman), 0);
}
