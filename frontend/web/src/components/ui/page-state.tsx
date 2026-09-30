import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IconAlertCircle, IconInbox, IconInfo } from '@/components/icons';

// One loading, error, empty and stale-data pattern for every screen (plan §10.1.6, UI-SYSTEM-003
// part 2; FRONTEND_DESIGN_SYSTEM §31, §33, §34): loading is an announced line, never a blocking
// card; a failed load says so in a contained card with "Coba Lagi"; a refused one says who may
// see it, without a retry that cannot help; an empty page has a neutral icon, a heading, one
// line and at most one action; a refresh that fails keeps the last data and says so.

/** Data on its way: an announced line (FRONTEND_DESIGN_SYSTEM §31). */
function LoadingState({ children }: { children: React.ReactNode }) {
  return (
    <p data-slot="loading-state" role="status" className="m-0 text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * A load that failed ("failed", with "Coba Lagi") or was refused ("refused": no access or not
 * available, where a retry cannot help) (FRONTEND_DESIGN_SYSTEM §34).
 */
function LoadErrorState({
  kind,
  title,
  children,
  onRetry,
  retrying = false,
}: {
  kind: 'failed' | 'refused';
  title: string;
  children: React.ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <Alert data-state="load-error" variant={kind === 'failed' ? 'destructive' : 'default'}>
      {kind === 'failed' ? <IconAlertCircle aria-hidden="true" /> : <IconInfo aria-hidden="true" />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
      {kind === 'failed' && onRetry && (
        <Button variant="secondary" size="sm" className="col-start-2 mt-2 justify-self-start" onClick={onRetry} disabled={retrying}>
          Coba Lagi
        </Button>
      )}
    </Alert>
  );
}

/** Nothing to show yet (FRONTEND_DESIGN_SYSTEM §33): a neutral icon, a heading, one line, an optional action. */
function EmptyState({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section data-slot="empty-state" className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-10 text-center">
      <IconInbox aria-hidden="true" width={32} height={32} className="text-muted-foreground" />
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <p className="m-0 max-w-prose text-muted-foreground">{children}</p>
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  );
}

/** A refresh failed: the last data stays on the screen, and the screen says so. */
function StaleDataNotice({ title = 'Gagal memperbarui data', children }: { title?: string; children?: React.ReactNode }) {
  return (
    <Alert data-state="stale-data" variant="warning">
      <IconInfo aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children ?? 'Data yang tampil adalah data terakhir.'}</AlertDescription>
    </Alert>
  );
}

/**
 * The page of a screen whose content is not there: its data is loading, or it failed or was
 * refused, or the screen itself is still downloading (WEB-001). An optional way back, the
 * screen's level-one heading (the one it shows once loaded), then the state: a page keeps its
 * heading in every state (UI consistency audit M13).
 */
function PageStateFrame({ title, back, children }: { title: string; back?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main data-slot="page-state-frame" className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6 md:px-6">
      {back}
      <h1 className="m-0 text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

export { EmptyState, LoadErrorState, LoadingState, PageStateFrame, StaleDataNotice };
