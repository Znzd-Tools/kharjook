import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4 space-y-4">
      {icon && (
        <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-500">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-zinc-200 text-sm font-medium">{title}</p>
        {description && (
          <p className="text-zinc-500 text-xs leading-relaxed max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="flex flex-col items-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white/6 hover:bg-white/10 text-zinc-100 text-sm font-medium"
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="text-zinc-500 hover:text-zinc-400 text-xs"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
