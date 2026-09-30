import React, { lazy } from 'react';

import { LoadErrorState, LoadingState } from '@/components/ui/page-state';

/** The file of a screen loaded on demand could not be downloaded (offline, or a release replaced it). */
class ScreenLoadError extends Error {
  constructor(cause: unknown) {
    super('A screen could not be downloaded', { cause });
    this.name = 'ScreenLoadError';
  }
}

/** A screen downloaded the first time it is shown (WEB-001); a failed download is a `ScreenLoadError`. */
export function onDemand<P extends object>(load: () => Promise<React.ComponentType<P>>): React.LazyExoticComponent<React.ComponentType<P>> {
  return lazy(() => load().then(
    component => ({ default: component }),
    cause => { throw new ScreenLoadError(cause); },
  ));
}

/**
 * A screen's page before its file is there: its level-one heading (the one the screen shows
 * once loaded, `lib/screen-titles.ts`), then the state, so the page keeps its heading in every
 * state as the lists do (UI-SYSTEM-003).
 */
function ScreenFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6 md:px-6">
      <h1 className="m-0 text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

/** A screen whose file is downloading. */
export function ScreenLoading({ title }: { title: string }) {
  return (
    <ScreenFrame title={title}>
      <LoadingState>Memuat halaman...</LoadingState>
    </ScreenFrame>
  );
}

/**
 * A screen loaded on demand that could not be downloaded: the shared failed-load state with
 * "Coba Lagi", which reloads the page (WEB-001). Any other error is not a download failure and
 * goes on as it did before screens were loaded on demand.
 */
export class ScreenLoadBoundary extends React.Component<{ title: string; children: React.ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (!(error instanceof ScreenLoadError)) throw error;
    return (
      <ScreenFrame title={this.props.title}>
        <LoadErrorState kind="failed" title="Gagal Memuat Halaman" onRetry={() => window.location.reload()}>
          Periksa koneksi internet Anda, lalu coba lagi.
        </LoadErrorState>
      </ScreenFrame>
    );
  }
}
