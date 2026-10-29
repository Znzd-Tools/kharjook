'use client';

/**
 * App-wide layout primitives. Screens compose these instead of hand-rolling
 * card/list/header markup, so spacing, radius and type stay consistent.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { haptic } from '@/shared/utils/haptics';

// ─── Page ────────────────────────────────────────────────────────────────────

/** Standard page body: gutter, vertical rhythm, entrance animation. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-4 pt-4 pb-8 space-y-7 animate-[fade-in_250ms_ease-out] ${className}`}>
      {children}
    </div>
  );
}

/** Pill button for a sub-page's primary "add" action, placed in PageHeader actions. */
export function HeaderAction({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  const cls =
    'inline-flex h-9 items-center gap-1 rounded-full bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 hover:bg-white transition-colors';
  const body = (
    <>
      <Plus size={15} strokeWidth={2.25} />
      {label}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} onClick={() => haptic('selection')}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  );
}

/** Sticky header for sub-pages: back button, title, optional trailing actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
  onBack,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header
      className={`sticky top-0 z-20 flex items-center gap-2 px-3 pt-safe pb-3 bg-surface-shell/85 backdrop-blur-md border-b border-white/5 ${className}`}
    >
      <IconButton label="بازگشت" onClick={onBack ?? (() => router.back())}>
        <ArrowRight size={20} strokeWidth={1.75} />
      </IconButton>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold text-zinc-50">{title}</h2>
        {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export type SectionAction = { label: string; href?: string; onClick?: () => void };

/** Titled block with an optional "see all" style action on the leading edge. */
export function Section({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: SectionAction;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
          </div>
          {action && <TextLink {...action} />}
        </div>
      )}
      {children}
    </section>
  );
}

export function TextLink({ label, href, onClick }: SectionAction) {
  const cls =
    'inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors';
  const content = (
    <>
      {label}
      <ChevronLeft size={14} />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} onClick={() => haptic('selection')}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/5 bg-surface-raised ${padded ? 'p-4' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Lists ───────────────────────────────────────────────────────────────────

/** Inset grouped list (iOS-style): one card, hairline dividers between rows. */
export function ListGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/5 bg-surface-raised divide-y divide-white/5 ${className}`}
    >
      {children}
    </div>
  );
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  trailingSub,
  href,
  onClick,
  chevron = false,
  className = '',
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  trailingSub?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-100">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</div>}
      </div>
      {(trailing || trailingSub) && (
        <div className="shrink-0 text-left">
          {trailing && <div className="text-sm font-semibold text-zinc-100">{trailing}</div>}
          {trailingSub && <div className="mt-0.5 text-xs text-zinc-500">{trailingSub}</div>}
        </div>
      )}
      {chevron && <ChevronLeft size={16} className="shrink-0 text-zinc-600" />}
    </>
  );
  const cls = `flex w-full items-center gap-3 px-4 py-3.5 text-right ${className}`;
  const interactive = 'hover:bg-surface-hover active:bg-surface-active transition-colors';
  if (href) {
    return (
      <Link href={href} className={`${cls} ${interactive}`} onClick={() => haptic('selection')}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} ${interactive}`}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Round tinted icon used as a list row leading element. */
export function IconBadge({
  children,
  color,
  size = 'md',
}: {
  children: ReactNode;
  /** Hex color; tint and glyph derive from it. Neutral when omitted. */
  color?: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <span
      className={`flex ${dim} items-center justify-center rounded-full ${color ? '' : 'bg-white/6 text-zinc-300'}`}
      style={color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      {children}
    </span>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

export function IconButton({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls =
    'inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 hover:bg-white/6 hover:text-zinc-50 transition-colors';
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={cls} onClick={() => haptic('selection')}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex rounded-xl bg-white/5 p-1 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (active) return;
              haptic('selection');
              onChange(opt.value);
            }}
            className={`flex-1 rounded-lg font-medium transition-colors ${
              size === 'sm' ? 'h-7 text-xs' : 'h-9 text-sm'
            } ${active ? 'bg-surface-active text-zinc-50 shadow-sm shadow-black/40' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Data display ────────────────────────────────────────────────────────────

/** Money string with optional sign tone. Always LTR so digits/sign align. */
export function Money({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'muted';
  className?: string;
}) {
  const toneClass = {
    neutral: '',
    positive: 'text-emerald-400',
    negative: 'text-rose-400',
    muted: 'text-zinc-500',
  }[tone];
  return (
    <span dir="ltr" className={`tabular-nums ${toneClass} ${className}`}>
      {children}
    </span>
  );
}

/** Small label + value pair for stat rows. */
export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-100">
        <Money tone={tone}>{value}</Money>
      </p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'accent',
  marker,
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'positive' | 'negative' | 'warning' | 'neutral';
  /** Optional target marker position on the same scale as value. */
  marker?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = {
    accent: 'bg-accent-400',
    positive: 'bg-emerald-400',
    negative: 'bg-rose-400',
    warning: 'bg-amber-400',
    neutral: 'bg-zinc-300',
  }[tone];
  const markerPct =
    marker != null && max > 0 ? Math.max(0, Math.min(100, (marker / max) * 100)) : null;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-white/6" dir="rtl">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      {markerPct != null && (
        <span
          aria-hidden
          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-zinc-100"
          style={{ right: `calc(${markerPct}% - 1px)` }}
        />
      )}
    </div>
  );
}

/** Pill for P/L deltas and statuses. */
export function DeltaPill({ value, children }: { value: number; children: ReactNode }) {
  const positive = value >= 0;
  return (
    <span
      dir="ltr"
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        positive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'
      }`}
    >
      {children}
    </span>
  );
}

/** iOS-style on/off switch. Purely visual: the caller owns the button semantics. */
export function SwitchVisual({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-emerald-500' : 'bg-white/12'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[right] ${
          checked ? 'right-1' : 'right-6'
        }`}
      />
    </span>
  );
}
