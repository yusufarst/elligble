import * as React from 'react';

import { cn } from '@/lib/utils';

// One metric box for every screen (plan §10.1.6, UI-SYSTEM-003 part 3; audit C4): a bordered
// box on the page background, the label small and quiet, the value large with even figures.
// A term list, so a screen reader reads each label with its value.

/**
 * The grid of a metric list:
 * - `default`: two columns, four from `sm`;
 * - `narrowFirst`: one column below 480 px, two from 480 px and four from `sm`, so a label wraps only at
 *   spaces at 200 % text and never needs `overflow-wrap: anywhere` (ASSESS-INSTITUTION-002 F7). Use it where
 *   labels are long words ("Ruang tanpa pengawas", "Aturan mulai terlambat"); set `min-w-0` on each Metric.
 */
const METRIC_LIST_LAYOUT = {
  default: 'm-0 grid grid-cols-2 gap-3 sm:grid-cols-4',
  narrowFirst: 'm-0 grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-4',
} as const;

function MetricList({ className, layout = 'default', ...props }: React.ComponentProps<'dl'> & { layout?: keyof typeof METRIC_LIST_LAYOUT }) {
  return <dl data-slot="metric-list" className={cn(METRIC_LIST_LAYOUT[layout], className)} {...props} />;
}

/** A count by default; a value that is text (a date, a window) takes `valueClassName="text-sm font-medium"`. */
function Metric({ label, value, className, valueClassName }: { label: React.ReactNode; value: React.ReactNode; className?: string; valueClassName?: string }) {
  return (
    <div data-slot="metric" className={cn('rounded-md border border-border bg-background px-3 py-2', className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn('m-0 text-xl font-semibold tabular-nums', valueClassName)}>{value}</dd>
    </div>
  );
}

export { Metric, MetricList };
