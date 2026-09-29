import React from 'react';
import { Button } from '@/components/ui/button';
import { IconBuilding, IconClipboardCheck, IconLogOut, IconMonitor, IconBook } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { MeContext } from '../api/auth-client.ts';
import { tenantLabel } from './SessionScreens.tsx';

export type Workspace = 'student' | 'proctor' | 'teacher';

export const WORKSPACE_LABELS: Record<Workspace, string> = {
  student: 'Jadwal Ujian',
  proctor: 'Ruang Ujian',
  teacher: 'Pelaksanaan Ujian',
};

const WORKSPACE_ICONS: Record<Workspace, React.FC> = {
  student: IconBook,
  proctor: IconMonitor,
  teacher: IconClipboardCheck,
};

export function availableWorkspaces(me: MeContext): Workspace[] {
  const list: Workspace[] = [];
  if (me.capabilities.examParticipant) list.push('student');
  if (me.capabilities.proctor) list.push('proctor');
  if (me.capabilities.teacher) list.push('teacher');
  return list;
}

export const AppShell: React.FC<{
  me: MeContext;
  username: string | null;
  workspaces: Workspace[];
  current: Workspace | null;
  canSwitchTenant: boolean;
  onNavigate(workspace: Workspace): void;
  onSwitchTenant(): void;
  onLogout(): void;
  children: React.ReactNode;
}> = ({ me, username, workspaces, current, canSwitchTenant, onNavigate, onSwitchTenant, onLogout, children }) => (
  <div className="flex min-h-dvh flex-col bg-background">
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 md:flex-nowrap md:px-6">
        <span className="order-1 font-mono text-xs font-semibold tracking-[0.2em] text-foreground">ELLIGBLE</span>
        {/* Tenant context stays visible at every width (D02.2-20): own row on small screens. */}
        <span className="order-3 flex w-full min-w-0 items-center gap-2 text-sm text-muted-foreground md:order-2 md:w-auto">
          <IconBuilding className="shrink-0" />
          <span className="truncate" data-testid="active-tenant">{tenantLabel(me.tenantDisplayLabel, me.tenantId)}</span>
        </span>
        <div className="order-2 ml-auto flex items-center gap-1 md:order-3">
          {username && (
            <span className="hidden max-w-[200px] truncate px-2 text-sm text-muted-foreground md:inline" title={username}>
              {username}
            </span>
          )}
          {canSwitchTenant && (
            <Button variant="ghost" size="sm" className="h-11" onClick={onSwitchTenant}>Ganti Sekolah</Button>
          )}
          <Button variant="ghost" size="sm" className="h-11" onClick={onLogout}>
            <IconLogOut />
            Keluar
          </Button>
        </div>
      </div>
      {workspaces.length > 1 && (
        <nav aria-label="Ruang kerja" className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-2 md:px-4">
          {workspaces.map(w => {
            const Icon = WORKSPACE_ICONS[w];
            const active = w === current;
            return (
              <button
                key={w}
                type="button"
                onClick={() => onNavigate(w)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon />
                {WORKSPACE_LABELS[w]}
              </button>
            );
          })}
        </nav>
      )}
    </header>
    <div className="flex-1">{children}</div>
  </div>
);
