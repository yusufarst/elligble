import * as React from 'react';
import { cn } from '@/lib/utils';

// Native select themed for ELLIGBLE (§19-§22; ASSESS-QUESTION-004 §4A.4): the field look of Input
// (border, 16px text, black focus outline), so a select reads as the same product everywhere.
// Size "default" is the 44px form field; size "exam" is the 48px answer control of the exam
// screen. A native select keeps the platform picker, keyboard and screen-reader behaviour.

type NativeSelectSize = 'default' | 'exam';

function NativeSelect({ className, size = 'default', ...props }: Omit<React.ComponentProps<'select'>, 'size'> & { size?: NativeSelectSize }) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'flex w-full min-w-0 rounded-md border border-input bg-background px-3.5 py-2.5 text-base text-foreground shadow-sm',
        'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
        size === 'exam' ? 'h-12' : 'h-11',
        className
      )}
      {...props}
    />
  );
}

export { NativeSelect };
