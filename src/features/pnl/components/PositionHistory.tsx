'use client';

import { Amount, Badge, List, ListRow, Section } from '@/design-system';
import { formatJalaaliHuman, parseJalaali } from '@/shared/utils/jalali';
import type { PositionPeriod } from '../utils/position-history';

const human = (d: string | null) => {
  if (!d) return 'الان';
  const p = parseJalaali(d);
  return p ? formatJalaaliHuman(p) : d;
};

/** Every holding period of one asset, newest first (P3). */
export function PositionHistory({ periods }: { periods: PositionPeriod[] }) {
  if (periods.length === 0) return null;
  return (
    <Section title="دوره‌های نگهداری" description="هر دوره از خرید تا وقتی موجودی صفر شد">
      <List>
        {periods.map((p) => {
          const total = p.realizedToman + p.unrealizedToman;
          return (
            <ListRow
              key={`${p.start}-${p.end ?? 'open'}`}
              title={
                <span className="inline-flex items-center gap-2">
                  {human(p.start)} تا {human(p.end)}
                  {p.end === null && <Badge tone="accent">دوره فعلی</Badge>}
                </span>
              }
              subtitle={
                p.end === null
                  ? `محقق‌شده ${Math.round(p.realizedToman).toLocaleString('fa-IR')} · باز ${Math.round(p.unrealizedToman).toLocaleString('fa-IR')} تومان`
                  : 'بسته شده'
              }
              trailing={<Amount value={total} size="sm" compact tone="auto" signed />}
            />
          );
        })}
      </List>
    </Section>
  );
}
