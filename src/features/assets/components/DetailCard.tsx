'use client';

import type { ReactNode } from 'react';
import { StatTile, Text } from '@/design-system';

export interface DetailCardProps {
  label: string;
  value: ReactNode;
}

export function DetailCard({ label, value }: DetailCardProps) {
  return (
    <StatTile
      label={label}
      value={
        typeof value === 'string' ? (
          <Text variant="callout" weight="semibold" className="truncate">
            <span dir="ltr">{value}</span>
          </Text>
        ) : (
          value
        )
      }
    />
  );
}
