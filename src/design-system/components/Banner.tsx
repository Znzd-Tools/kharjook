import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type BannerTone = 'info' | 'positive' | 'warning' | 'negative' | 'accent';

const TONES: Record<BannerTone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-info-soft text-info-ink', icon: <Info /> },
  positive: { box: 'bg-positive-soft text-positive-ink', icon: <CheckCircle2 /> },
  warning: { box: 'bg-warning-soft text-warning-ink', icon: <AlertTriangle /> },
  negative: { box: 'bg-negative-soft text-negative-ink', icon: <XCircle /> },
  accent: { box: 'bg-accent-soft text-accent-ink', icon: <Info /> },
};

export interface BannerProps {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Replace the default tone icon. Pass `null` to hide. */
  icon?: ReactNode | null;
  /** Inline action, e.g. `<Button size="sm" variant="link">`. */
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Inline message inside a page (not a toast). */
export function Banner({ tone = 'info', title, children, icon, action, onDismiss, className }: BannerProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === 'negative' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-card p-3.5', t.box, className)}
    >
      {icon !== null && <span className="mt-0.5 shrink-0 [&_svg]:size-4.5">{icon ?? t.icon}</span>}
      <div className="min-w-0 flex-1 space-y-0.5 text-caption">
        {title && <p className="text-callout font-semibold">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
        {action && <div className="pt-1.5">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="بستن"
          className="ds-focus -m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-pressed [&_svg]:size-4"
        >
          <X />
        </button>
      )}
    </div>
  );
}
