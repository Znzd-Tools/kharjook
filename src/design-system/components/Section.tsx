import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SectionProps {
  title?: ReactNode;
  /** Small text under the title. */
  description?: ReactNode;
  /** Right-aligned action, usually a `Button variant="link"` "همه". */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Element id for the heading, used for aria-labelledby. */
  id?: string;
}

/** Titled group of content on a page. The main layout block. */
export function Section({ title, description, action, children, className, id }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn('space-y-3', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-body font-semibold text-fg">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-caption text-fg-subtle">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
