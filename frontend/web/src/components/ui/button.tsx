import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui Button (new-york v4) themed for ELLIGBLE: 44px touch targets (§3), canonical
// 2px focus outline (§37), primary black / secondary bordered white / ghost gray (§17).
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
