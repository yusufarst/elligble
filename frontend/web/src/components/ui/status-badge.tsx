import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// One status badge for every role (plan §10.1.6/7, UI-SYSTEM-003): a state has the same tone
// on every screen, and its word always says what the color shows. A pill, like the
// DesainPakeAI status chip (revision sha256-5d0d7779...), which keeps pills for statuses and
// compact metadata. The words and tones of each state live in `lib/status.ts`.
const statusBadgeVariants = cva('inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium leading-4', {
  variants: {
    tone: {
      /** Running now: an exam in progress, a participant working. */
      active: 'bg-active-surface text-active-ink',
      /** Done as intended: submitted, final results. */
      success: 'bg-success-surface text-success-ink',
      /** Needs attention without being an error: paused, locked. */
      warning: 'bg-warning-surface text-warning-ink',
      /** Failed or over: time ran out. */
      danger: 'bg-danger-surface text-danger-ink',
      /** Upcoming or informative: ready to open. */
      info: 'bg-info-surface text-info-ink',
      /** At rest: scheduled, not started, ended, cancelled, metadata. */
      neutral: 'bg-neutral-surface text-neutral-ink',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type StatusTone = 'active' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

function StatusBadge({ className, tone = 'neutral', ...props }: React.ComponentProps<'span'> & { tone?: StatusTone }) {
  return <span data-slot="status-badge" data-tone={tone} className={cn(statusBadgeVariants({ tone }), className)} {...props} />;
}

export { StatusBadge, statusBadgeVariants };
