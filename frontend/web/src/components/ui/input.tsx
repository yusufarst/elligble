import * as React from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui Input themed for ELLIGBLE (§19-§22): 44px height, 10px 14px padding,
// 16px text (no mobile zoom), black focus border, danger border when aria-invalid.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3.5 py-2.5 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
        'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'aria-invalid:border-danger',
        className
      )}
      {...props}
    />
  );
}

export { Input };
