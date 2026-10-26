import * as React from 'react';

import { cn } from '@/lib/utils';

// One page frame for every screen of the role shell (plan §10.1.5, UI-SYSTEM-002 part 2; audit C3):
// the content width is one of three documented variants instead of a width per page, with the
// same padding and section spacing, and one page title. The exam focus shell has its own frame.

const PAGE_WIDTH = {
  /** A short message on its own: no workspace, a notice. */
  narrow: 'max-w-[540px]',
  /** The student's own list: one column to read and act on (§10.1.10, student focused). */
  focused: 'max-w-[720px]',
  /** The teacher and proctor lists and every detail screen. */
  standard: 'max-w-[960px]',
} as const;

export type PageWidth = keyof typeof PAGE_WIDTH;

const PRODUCT_NAME = 'ELLIGBLE';

/** The browser tab names the screen (WCAG 2.4.2); the product name alone when it has none. */
function useDocumentTitle(title: string) {
  React.useEffect(() => {
    if (!title) return;
    document.title = `${title} · ${PRODUCT_NAME}`;
    return () => {
      document.title = PRODUCT_NAME;
    };
  }, [title]);
}

function Page({ width = 'standard', className, ...props }: React.ComponentProps<'main'> & { width?: PageWidth }) {
  return (
    <main
      data-slot="page"
      data-width={width}
      className={cn('mx-auto flex w-full flex-col gap-5 px-4 py-6 md:px-6', PAGE_WIDTH[width], className)}
      {...props}
    />
  );
}

/** The screen's level-one heading, also the name of the browser tab. */
function PageTitle({ children }: { children: string }) {
  useDocumentTitle(children);
  return <h1 data-slot="page-title" className="m-0 text-2xl font-semibold">{children}</h1>;
}

/**
 * The page header: the title, then optional lines under it (the exam's subject, its window, a
 * short description), and the page's own actions beside it from 640 px, below it on a phone.
 */
function PageHeader({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header data-slot="page-header" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <PageTitle>{title}</PageTitle>
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export { Page, PageHeader, PageTitle };
