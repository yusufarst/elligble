import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoginForm } from './LoginForm.tsx';

// Blocking re-authentication over the current screen. The screen underneath stays
// mounted, so an exam in progress keeps its state (D04.1-70: ordinary session expiry
// must not destroy an active attempt).
export const ReauthDialog: React.FC<{
  open: boolean;
  username: string | null;
  onReauthenticate(username: string, password: string): Promise<void>;
  onLogout(): void;
}> = ({ open, username, onReauthenticate, onLogout }) => (
  <Dialog open={open}>
    <DialogContent
      hideClose
      onEscapeKeyDown={e => e.preventDefault()}
      onInteractOutside={e => e.preventDefault()}
      aria-describedby="reauth-description"
    >
      <DialogHeader>
        <DialogTitle>Sesi Anda Telah Berakhir</DialogTitle>
        <DialogDescription id="reauth-description">
          Demi keamanan, masuk kembali untuk melanjutkan. Jangan tutup atau muat ulang halaman ini.
        </DialogDescription>
      </DialogHeader>
      <LoginForm onSubmit={onReauthenticate} submitLabel="Masuk Kembali" fixedUsername={username} />
      <Button variant="ghost" onClick={onLogout}>Keluar</Button>
    </DialogContent>
  </Dialog>
);
