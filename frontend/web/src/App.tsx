import React, { useCallback, useEffect, useState } from 'react';
import './styles/globals.css';
import './styles/workstation.css';
import { AttemptLaunch } from './components/AttemptLaunch.tsx';
import { AssignedExamDiscovery } from './components/AssignedExamDiscovery.tsx';
import { ProctorMonitoringView } from './components/ProctorMonitoringView.tsx';
import { TeacherReadinessView } from './components/TeacherReadinessView.tsx';
import { TeacherResultsView } from './components/TeacherResultsView.tsx';
import { ExamMonitoringView } from './components/ExamMonitoringView.tsx';
import { SessionProvider, useSession } from './session/SessionProvider.tsx';
import { LoginScreen, NoMembershipScreen, StatusScreen, TenantPicker } from './session/SessionScreens.tsx';
import { ReauthDialog } from './session/ReauthDialog.tsx';
import { AppShell, availableWorkspaces, type Workspace } from './session/AppShell.tsx';
import { Button } from '@/components/ui/button';
import type { MeContext } from './api/auth-client.ts';
import { setDisplayTimeZone } from './lib/format.ts';

interface RouteState {
  attemptId: string | null;
  view: string | null;
  /** Teacher workspace: the exam whose results are open. */
  examResults: string | null;
  /** Proctor or teacher workspace: the exam whose participants are being monitored. */
  monitorExam: string | null;
}

function readRoute(): RouteState {
  const params = new URLSearchParams(window.location.search);
  return { attemptId: params.get('attemptId'), view: params.get('view'), examResults: params.get('examResults'), monitorExam: params.get('monitorExam') };
}

function pushRoute(search: string): void {
  try {
    window.history.pushState({}, '', search || window.location.pathname);
  } catch {
    // History API unavailable: in-memory route state still updates.
  }
}

const AuthenticatedApp: React.FC<{ me: MeContext; username: string | null; membershipCount: number }> = ({ me, username, membershipCount }) => {
  // Every time below is shown in the school's zone (D04.2-36); set before any child formats.
  setDisplayTimeZone(me.tenantTimeZone);
  const session = useSession();
  const [route, setRoute] = useState<RouteState>(readRoute);

  useEffect(() => {
    const handlePopState = () => setRoute(readRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((search: string) => {
    pushRoute(search);
    setRoute(readRoute());
  }, []);

  // Active exam: focus workspace without global navigation (FRONTEND_DESIGN_SYSTEM §50).
  if (route.attemptId) {
    return <AttemptLaunch key={route.attemptId} onExit={() => navigate('?view=student')} />;
  }

  const workspaces = availableWorkspaces(me);
  const requested = route.view as Workspace | null;
  const current: Workspace | null = requested && workspaces.includes(requested) ? requested : workspaces[0] ?? null;
  const requestedUnavailable = requested !== null && !workspaces.includes(requested);

  let content: React.ReactNode;
  if (current === 'student') {
    content = <AssignedExamDiscovery onSelectAttempt={attemptId => navigate(`?attemptId=${encodeURIComponent(attemptId)}`)} />;
  } else if (current === 'proctor') {
    content = route.monitorExam ? (
      <ExamMonitoringView key={route.monitorExam} examInstanceId={route.monitorExam} backLabel="Kembali ke Monitoring Ujian" onBack={() => navigate('?view=proctor')} />
    ) : (
      <ProctorMonitoringView onOpenExam={id => navigate(`?view=proctor&monitorExam=${encodeURIComponent(id)}`)} />
    );
  } else if (current === 'teacher' && route.monitorExam) {
    content = (
      <ExamMonitoringView key={route.monitorExam} examInstanceId={route.monitorExam} backLabel="Kembali ke Pelaksanaan Ujian" onBack={() => navigate('?view=teacher')} />
    );
  } else if (current === 'teacher') {
    content = route.examResults ? (
      <TeacherResultsView key={route.examResults} examInstanceId={route.examResults} onBack={() => navigate('?view=teacher')} />
    ) : (
      <TeacherReadinessView
        onOpenResults={id => navigate(`?view=teacher&examResults=${encodeURIComponent(id)}`)}
        onOpenMonitoring={id => navigate(`?view=teacher&monitorExam=${encodeURIComponent(id)}`)}
      />
    );
  } else {
    content = (
      <main className="mx-auto max-w-[540px] px-4 py-12 text-center">
        <h1 className="m-0 text-2xl font-semibold">Belum Ada Ruang Kerja</h1>
        <p className="mt-3 text-muted-foreground">
          Akun Anda belum memiliki penugasan ujian, pengawasan, atau mengajar di sekolah ini. Hubungi operator sekolah Anda.
        </p>
      </main>
    );
  }

  return (
    <AppShell
      me={me}
      username={username}
      workspaces={workspaces}
      current={current}
      canSwitchTenant={membershipCount > 1}
      onNavigate={w => navigate(`?view=${w}`)}
      onSwitchTenant={session.switchTenant}
      onLogout={session.logout}
    >
      {requestedUnavailable && (
        <p role="status" className="mx-auto mt-4 max-w-[1440px] px-4 text-sm text-muted-foreground md:px-6">
          Halaman yang diminta tidak tersedia untuk akun Anda. Menampilkan ruang kerja yang tersedia.
        </p>
      )}
      {content}
    </AppShell>
  );
};

const SessionGate: React.FC = () => {
  const session = useSession();
  const { phase } = session;

  switch (phase.kind) {
    case 'checking':
    case 'loading_context':
      return <StatusScreen title="Memverifikasi sesi..." />;
    case 'unavailable':
      return (
        <StatusScreen
          title="Gagal Terhubung ke Server"
          body="Periksa koneksi internet Anda dan coba lagi. Jika kendala berlanjut, hubungi operator sekolah."
          action={<Button onClick={session.retry}>Coba Lagi</Button>}
        />
      );
    case 'anonymous':
      return <LoginScreen onLogin={session.login} onActivate={session.activate} />;
    case 'no_membership':
      return <NoMembershipScreen onLogout={session.logout} />;
    case 'selecting_tenant':
      return <TenantPicker session={phase.session} onSelect={session.selectTenant} onLogout={session.logout} />;
    case 'ready':
      return (
        <>
          <AuthenticatedApp
            key={`${phase.session.username ?? ''}:${phase.me.tenantId}`}
            me={phase.me}
            username={phase.session.username}
            membershipCount={phase.session.memberships.length}
          />
          <ReauthDialog
            open={session.expired}
            username={phase.session.username}
            onReauthenticate={session.reauthenticate}
            onLogout={session.logout}
          />
        </>
      );
  }
};

export const App: React.FC = () => (
  <SessionProvider>
    <SessionGate />
  </SessionProvider>
);

export default App;
