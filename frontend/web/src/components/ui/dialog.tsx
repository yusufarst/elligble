import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { IconClose } from '@/components/icons';

// shadcn/ui Dialog themed for ELLIGBLE (§28): dark translucent backdrop, focus trap,
// Escape closes non-critical dialogs; `hideClose` + onEscapeKeyDown/onInteractOutside
// preventDefault make a dialog blocking.
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogContent({
  className,
  children,
  hideClose = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.6)]" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg',
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <IconClose />
            <span className="sr-only">Tutup</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-2 pr-10', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn('m-0 text-xl font-semibold', className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn('m-0 text-sm text-muted-foreground', className)} {...props} />;
}

/** The dialog's actions: stacked with the main one on top below 640 px, a row at the end above. */
function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
