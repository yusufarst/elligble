import * as React from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui Input themed for ELLIGBLE (§19-§22): 44px height, 10px 14px padding,
// 16px text (no mobile zoom), black focus border, danger border when aria-invalid. The documented
// "exam" size (ASSESS-QUESTION-007 §4.4) is the 48px answer field of the exam screen, as
// NativeSelect's; the prop is not named "size", a native input attribute.
function Input({ className, type, inputSize = 'default', ...props }: React.ComponentProps<'input'> & { inputSize?: 'default' | 'exam' }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputSize === 'exam' ? 'h-12' : 'h-11',
        'flex w-full min-w-0 rounded-md border border-input bg-background px-3.5 py-2.5 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
        'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'aria-invalid:border-danger',
        className
      )}
      {...props}
    />
  );
}

export { Input };
