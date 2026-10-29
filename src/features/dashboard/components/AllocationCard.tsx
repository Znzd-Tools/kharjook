'use client';

import { useState } from 'react';
import { Card, Money, SegmentedControl, Section } from '@/shared/components/ui';

export type AllocationRow = { id: string; name: string; value: number; label: string; color: string };

const MAX_ROWS = 6;

/** Where the money sits — by group or by single asset — as ranked bars. */
export function AllocationCard({
  groups,
  assets,
}: {
  groups: AllocationRow[];
  assets: AllocationRow[];
}) {
  const [mode, setMode] = useState<'groups' | 'assets'>('groups');
  const rows = mode === 'groups' ? groups : assets;
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (groups.length === 0 && assets.length === 0) return null;

  return (
    <Section title="ترکیب سبد">
      <Card className="space-y-4">
        <SegmentedControl
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'groups', label: 'گروه‌ها' },
            { value: 'assets', label: 'دارایی‌ها' },
          ]}
        />
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {rows.map((row) => (
            <div
              key={row.id}
              className="h-full first:rounded-r-full last:rounded-l-full"
              style={{ width: `${total > 0 ? (row.value / total) * 100 : 0}%`, backgroundColor: row.color }}
            />
          ))}
        </div>
        <ul className="space-y-2.5">
          {rows.slice(0, MAX_ROWS).map((row) => {
            const pct = total > 0 ? (row.value / total) * 100 : 0;
            return (
              <li key={row.id} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="min-w-0 flex-1 truncate text-zinc-300">{row.name}</span>
                <Money className="shrink-0 text-xs text-zinc-500">{row.label}</Money>
                <Money className="w-12 shrink-0 text-left text-xs font-semibold text-zinc-100">
                  {pct.toFixed(1)}%
                </Money>
              </li>
            );
          })}
        </ul>
      </Card>
    </Section>
  );
}
