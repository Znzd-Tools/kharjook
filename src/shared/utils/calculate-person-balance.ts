import type { Person, Transaction } from '@/shared/types/domain';

/**
 * Positive => person بدهکار (owes user)
 * Negative => person بستانکار (user owes person)
 * Starts from the person's opening balance, in the person's currency.
 */
export function calculatePersonBalance(
  person: Pick<Person, 'id' | 'initial_balance'>,
  transactions: Transaction[]
): number {
  let balance = Number(person.initial_balance) || 0;
  for (const tx of transactions) {
    if (tx.target_person_id === person.id) {
      balance += Number(tx.target_amount) || 0;
    }
    if (tx.source_person_id === person.id) {
      balance -= Number(tx.source_amount) || 0;
    }
  }
  return balance;
}
