import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui Alert with ELLIGBLE semantic states (§11): sparse, bordered, never a
// saturated backdrop.
const alertVariants = cva(
  'relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-md border px-4 py-3 text-sm has-[>svg]:grid-cols-[18px_1fr] [&>svg]:mt-0.5 [&>svg]:size-[18px] [&>*:not(svg)]:col-start-2',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        info: 'border-info-line bg-info-surface text-info-ink',
        warning: 'border-warning-line bg-warning-surface text-warning-ink',
        destructive: 'border-danger-line bg-danger-surface text-danger-ink',
        success: 'border-success-line bg-success-surface text-success-ink',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-title" className={cn('col-start-2 font-semibold leading-snug', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('col-start-2 leading-relaxed', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
