import * as React from 'react';

import { cn } from '@/lib/utils';

// One group of actions for every card and page section (plan §10.1.6/9, UI-SYSTEM-003 part 3;
// audit C5, M12): below 640 px the actions stack at full width, as the DesainPakeAI direction
// does; from 640 px they form a row that wraps, so no action ever runs out of its card.
function ActionGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="action-group" className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)} {...props} />;
}

export { ActionGroup };
