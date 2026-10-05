import * as React from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui Textarea themed like the ELLIGBLE Input (§19-§22): same border, padding, 16px
// text (no mobile zoom), black focus border and danger border when aria-invalid.
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full min-w-0 rounded-md border border-input bg-background px-3.5 py-2.5 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
        'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'aria-invalid:border-danger',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
