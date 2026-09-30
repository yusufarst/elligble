import React, { lazy } from 'react';

import { LoadErrorState, LoadingState, PageStateFrame } from '@/components/ui/page-state';

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

/** A screen whose file is downloading: its heading (`lib/screen-titles.ts`) and the loading line. */
export function ScreenLoading({ title }: { title: string }) {
  return (
    <PageStateFrame title={title}>
      <LoadingState>Memuat halaman...</LoadingState>
    </PageStateFrame>
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
      <PageStateFrame title={this.props.title}>
        <LoadErrorState kind="failed" title="Gagal Memuat Halaman" onRetry={() => window.location.reload()}>
          Periksa koneksi internet Anda, lalu coba lagi.
        </LoadErrorState>
      </PageStateFrame>
    );
  }
}
