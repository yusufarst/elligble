import React, { lazy } from 'react';

import { LoadErrorState, LoadingState, PageStateFrame } from '@/components/ui/page-state';
import { ScreenLoadError, screenFiles } from '../lib/screen-files.ts';

type StaffScreens = typeof import('../staff-screens.ts');

// The teacher and proctor screens are one file, downloaded the first time one of them is shown
// (WEB-001); the student's screens are in the first download, so an exam never waits for or
// depends on another file. The build names the file in index.html (vite.config.ts), so a retry
// can ask for it under a new address.
const staffScreens = screenFiles<StaffScreens>({
  load: () => import('../staff-screens.ts'),
  address: () => document.querySelector<HTMLMetaElement>('meta[name="elligble-staff-screens"]')?.content || null,
});

type Pick<P> = (screens: StaffScreens) => React.ComponentType<P>;

// One lazy component per download attempt and screen: React keeps a lazy component's failure,
// so a new attempt ("Coba Lagi", a navigation) needs a new one.
const lazyScreens = new WeakMap<Promise<StaffScreens>, Map<Pick<never>, React.ComponentType<never>>>();

function lazyScreen<P extends object>(attempt: Promise<StaffScreens>, pick: Pick<P>): React.ComponentType<P> {
  let screens = lazyScreens.get(attempt);
  if (!screens) lazyScreens.set(attempt, (screens = new Map()));
  let screen = screens.get(pick as Pick<never>) as React.ComponentType<P> | undefined;
  if (!screen) {
    screen = lazy(() => attempt.then(loaded => ({ default: pick(loaded) })));
    screens.set(pick as Pick<never>, screen as React.ComponentType<never>);
  }
  return screen;
}

/** A teacher or proctor screen, shown once the file of those screens is there. */
function onDemand<P extends object>(pick: Pick<P>) {
  return function OnDemandScreen(props: P) {
    const Screen = lazyScreen(staffScreens.get(), pick);
    return <Screen {...props} />;
  };
}

export const ProctorMonitoringView = onDemand(screens => screens.ProctorMonitoringView);
export const TeacherReadinessView = onDemand(screens => screens.TeacherReadinessView);
export const TeacherResultsView = onDemand(screens => screens.TeacherResultsView);
export const ExamMonitoringView = onDemand(screens => screens.ExamMonitoringView);
export const TeacherExamImportView = onDemand(screens => screens.TeacherExamImportView);
export const TeacherExamPreviewView = onDemand(screens => screens.TeacherExamPreviewView);

/** A screen whose file is downloading: its heading (`lib/screen-titles.ts`) and the loading line. */
export function ScreenLoading({ title }: { title: string }) {
  return (
    <PageStateFrame title={title}>
      <LoadingState>Memuat halaman...</LoadingState>
    </PageStateFrame>
  );
}

/**
 * A screen whose file could not be downloaded: its heading and the shared failed-load state.
 * "Coba Lagi" asks for the file again under a new address, or reloads the page when a release
 * replaced it; showing the screen anew (a navigation, the back button) also asks again. Any other
 * error is not a download failure and goes on as it did before screens were downloaded on demand.
 */
export class ScreenLoadBoundary extends React.Component<{ title: string; children: React.ReactNode }, { error: unknown; retrying: boolean }> {
  state = { error: null as unknown, retrying: false };

  constructor(props: { title: string; children: React.ReactNode }) {
    super(props);
    staffScreens.retry();
  }

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  private retry = async () => {
    this.setState({ retrying: true });
    if (await staffScreens.replaced()) {
      window.location.reload();
      return;
    }
    staffScreens.retry();
    this.setState({ error: null, retrying: false });
  };

  render() {
    const { error, retrying } = this.state;
    if (error === null) return this.props.children;
    if (!(error instanceof ScreenLoadError)) throw error;
    return (
      <PageStateFrame title={this.props.title}>
        <LoadErrorState kind="failed" title="Gagal Memuat Halaman" onRetry={() => void this.retry()} retrying={retrying}>
          Periksa koneksi internet Anda, lalu coba lagi.
        </LoadErrorState>
      </PageStateFrame>
    );
  }
}
