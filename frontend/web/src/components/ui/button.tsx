import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui Button (new-york v4) themed for ELLIGBLE: 44px touch targets (§3), canonical
// 2px focus outline (§37), primary black / secondary bordered white / ghost gray (§17). Every
// button of every screen, the exam focus shell included, is this one (plan §10.1.2).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/85',
        secondary: 'border border-border bg-background text-foreground shadow-sm hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        link: 'text-foreground underline underline-offset-4 hover:text-muted-foreground',
      },
      size: {
        default: 'h-11 px-5 text-[15px]',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11',
        // The exam action dock (UI-SYSTEM-002 part 2): below 1024 px a 44 px tile with the icon
        // over a short label in the fixed bottom bar; from 1024 px an inline button with its full label.
        dock: 'h-auto min-h-11 min-w-0 flex-col gap-1 px-1 py-1 text-[11px] leading-none lg:min-h-10 lg:flex-row lg:gap-1.5 lg:px-4 lg:py-2 lg:text-[13px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
