'use client';

import { IconButton } from '@/design-system';
import { Download } from '@/design-system/icons';

export function ReportExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return <IconButton size="sm" variant="ghost" aria-label="خروجی CSV" title="خروجی CSV" icon={<Download />} onClick={onClick} disabled={disabled} />;
}
