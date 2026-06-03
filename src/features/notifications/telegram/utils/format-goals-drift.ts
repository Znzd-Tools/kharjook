import type { GoalDriftRow } from '@/features/goals/utils/goal-drift-rows';
import {
  TELEGRAM_SEPARATOR,
  toPersianDigits,
} from '@/features/notifications/telegram/utils/format-helpers';

function formatAxisValue(row: GoalDriftRow): string {
  if (row.valueKind === 'percent') {
    return `${toPersianDigits(row.currentValue.toFixed(1))}٪ ← ${toPersianDigits(row.targetValue.toFixed(1))}٪`;
  }
  return `${toPersianDigits(row.currentValue.toLocaleString('en-US'))} ← ${toPersianDigits(row.targetValue.toLocaleString('en-US'))}`;
}

export function formatGoalsDriftMessage(rows: GoalDriftRow[]): string {
  const heading = '🎯 انحراف از اهداف سبد';
  if (rows.length === 0) {
    return `${heading}\n${TELEGRAM_SEPARATOR}\n✅ همه اهداف در محدوده هستند.\n${TELEGRAM_SEPARATOR}`;
  }

  const lines = [heading, TELEGRAM_SEPARATOR, ''];
  for (const row of rows.slice(0, 10)) {
    lines.push(`📌 ${row.name} (${row.kindLabel})`);
    lines.push(`   ${formatAxisValue(row)} · ${row.deltaLabel}`);
    if (row.actionSuggestion) {
      lines.push(`   💡 ${row.actionSuggestion}`);
    }
    lines.push('');
  }
  if (rows.length > 10) {
    lines.push(`… و ${toPersianDigits(rows.length - 10)} هدف دیگر`);
    lines.push('');
  }
  lines.push(TELEGRAM_SEPARATOR);
  return lines.join('\n').trim();
}
