import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconBuilding, IconChevronRight, IconInfo } from '@/components/icons';
import { LoginForm } from './LoginForm.tsx';
import { ActivationForm } from './ActivationForm.tsx';
import type { SessionInfo } from '../api/auth-client.ts';

function tenantLabel(label: string | null, tenantId: string): string {
  return label ?? `Sekolah (kode ${tenantId.slice(-4).toUpperCase()})`;
}

const CenteredPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="flex min-h-dvh items-start justify-center bg-muted px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))] sm:items-center">
    <div className="w-full max-w-[540px]">{children}</div>
  </main>
);

export const LoginScreen: React.FC<{
  onLogin(username: string, password: string): Promise<void>;
  onActivate?(username: string, activationCode: string, newPassword: string): Promise<void>;
}> = ({ onLogin, onActivate }) => {
  const [mode, setMode] = useState<'login' | 'activate'>('login');
  const activating = mode === 'activate' && onActivate;
  return (
    <CenteredPage>
      <p className="mb-6 text-center font-mono text-sm font-semibold tracking-[0.2em] text-foreground">ELLIGBLE</p>
      <Card>
        <CardHeader>
          <CardTitle level="h1">{activating ? 'Aktivasi Akun' : 'Masuk ke ELLIGBLE'}</CardTitle>
          <CardDescription>
            {activating
              ? 'Masukkan ELLIGBLE ID dan kode aktivasi dari sekolah, lalu buat kata sandi Anda sendiri.'
              : 'Gunakan ELLIGBLE ID dan kata sandi dari sekolah Anda.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {activating ? <ActivationForm onSubmit={onActivate} /> : <LoginForm onSubmit={onLogin} />}
          {onActivate && (
            <Button variant="link" className="self-center" onClick={() => setMode(activating ? 'login' : 'activate')}>
              {activating ? 'Kembali ke halaman masuk' : 'Belum pernah masuk? Aktifkan akun dengan kode aktivasi'}
            </Button>
          )}
        </CardContent>
      </Card>
      <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
        Lupa kata sandi atau kode aktivasi? Hubungi operator sekolah atau wali kelas Anda.
        <br />
        Petugas sekolah tidak pernah meminta kata sandi Anda.
      </p>
    </CenteredPage>
  );
};

export const StatusScreen: React.FC<{ title: string; body?: string; action?: React.ReactNode }> = ({ title, body, action }) => (
  <CenteredPage>
    <Card role="status" aria-live="polite">
      <CardHeader>
        <CardTitle level="h1">{title}</CardTitle>
        {body && <CardDescription>{body}</CardDescription>}
      </CardHeader>
      {action && <CardContent>{action}</CardContent>}
    </Card>
  </CenteredPage>
);

export const TenantPicker: React.FC<{
  session: SessionInfo;
  onSelect(tenantId: string): void;
  onLogout(): void;
}> = ({ session, onSelect, onLogout }) => (
  <CenteredPage>
    <Card>
      <CardHeader>
        <CardTitle level="h1">Pilih Sekolah</CardTitle>
        <CardDescription>Akun Anda terdaftar di lebih dari satu sekolah. Pilih sekolah yang ingin Anda buka.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {session.memberships.map(m => (
            <li key={m.tenantId}>
              <Button variant="secondary" className="h-auto min-h-12 w-full justify-between py-3 text-left" onClick={() => onSelect(m.tenantId)}>
                <span className="flex items-center gap-3 whitespace-normal">
                  <IconBuilding />
                  {tenantLabel(m.displayLabel, m.tenantId)}
                </span>
                <IconChevronRight />
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" onClick={onLogout}>Keluar</Button>
      </CardContent>
    </Card>
  </CenteredPage>
);

export const NoMembershipScreen: React.FC<{ onLogout(): void }> = ({ onLogout }) => (
  <CenteredPage>
    <Card>
      <CardHeader>
        <CardTitle level="h1">Akun Belum Terdaftar di Sekolah</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert variant="info">
          <IconInfo />
          <AlertDescription>Akun Anda belum terhubung dengan sekolah mana pun. Hubungi operator sekolah Anda.</AlertDescription>
        </Alert>
        <Button variant="secondary" onClick={onLogout}>Keluar</Button>
      </CardContent>
    </Card>
  </CenteredPage>
);

export { tenantLabel };
