export function fireExpenseAlert(transactionIds: string[]): void {
  if (transactionIds.length === 0) return;
  void fetch('/api/notifications/expense-alert', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transactionIds }),
  }).catch(() => {});
}
