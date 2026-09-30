import * as React from 'react';

import { cn } from '@/lib/utils';

// One metric box for every screen (plan §10.1.6, UI-SYSTEM-003 part 3; audit C4): a bordered
// box on the page background, the label small and quiet, the value large with even figures.
// A term list, so a screen reader reads each label with its value.

function MetricList({ className, ...props }: React.ComponentProps<'dl'>) {
  return <dl data-slot="metric-list" className={cn('m-0 grid grid-cols-2 gap-3 sm:grid-cols-4', className)} {...props} />;
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
