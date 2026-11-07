import React, { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconAlertCircle, IconEye, IconEyeOff } from '@/components/icons';
import { RecoveryError, type PasswordRejection } from '../api/auth-client.ts';

// AUTH-003 Student recovery (record §7): the ELLIGBLE ID, the single-use code handed over in
// person at school and the person's own new password. The server is the authority for the
// password policy; the length checks here only save a round trip.

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

const PASSWORD_COPY: Record<PasswordRejection, string> = {
  too_short: 'Kata sandi minimal 8 karakter.',
  too_long: 'Kata sandi terlalu panjang. Gunakan paling banyak 128 karakter.',
  too_common: 'Kata sandi ini terlalu umum atau mudah ditebak. Pilih kata sandi lain.',
  contains_username: 'Kata sandi tidak boleh memuat ELLIGBLE ID Anda.',
};

const FAILURE_COPY: Record<string, string> = {
  invalid_recovery: 'ELLIGBLE ID atau kode pemulihan tidak sesuai, sudah tidak berlaku, atau sudah kedaluwarsa. Kode berlaku 15 menit. Minta kode baru kepada operator sekolah atau wali kelas jika perlu.',
  already_completed: 'Pemulihan dengan kode ini sudah selesai. Masuk dengan kata sandi baru Anda.',
  busy: 'Server sedang sibuk. Coba lagi beberapa saat lagi.',
  invalid_request: 'Data pemulihan tidak valid. Periksa kembali isian Anda.',
  unavailable: 'Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.',
};

interface FieldErrors { username?: string; code?: string; password?: string; confirm?: string }

export interface RecoveryFormProps {
  onSubmit(username: string, recoveryCode: string, newPassword: string): Promise<void>;
}

export const RecoveryForm: React.FC<RecoveryFormProps> = ({ onSubmit }) => {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const ids = {
    user: useId(), code: useId(), pass: useId(), confirm: useId(), hint: useId(),
    userErr: useId(), codeErr: useId(), passErr: useId(), confirmErr: useId(),
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const next: FieldErrors = {};
    const length = [...password].length;
    if (!username.trim()) next.username = 'ELLIGBLE ID wajib diisi.';
    if (!code.trim()) next.code = 'Kode pemulihan wajib diisi.';
    if (!password) next.password = 'Kata sandi baru wajib diisi.';
    else if (length < MIN_LENGTH) next.password = PASSWORD_COPY.too_short;
    else if (length > MAX_LENGTH) next.password = PASSWORD_COPY.too_long;
    if (password && confirm !== password) next.confirm = 'Kedua kata sandi tidak sama.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      await onSubmit(username.trim(), code.trim(), password);
    } catch (err) {
      if (err instanceof RecoveryError && err.reason === 'password_rejected' && err.passwordRejection) {
        setErrors({ password: PASSWORD_COPY[err.passwordRejection] });
      } else {
        setFailure(FAILURE_COPY[err instanceof RecoveryError ? err.reason : 'unavailable'] ?? FAILURE_COPY.unavailable);
      }
      setPassword('');
      setConfirm('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4" aria-busy={submitting}>
      {failure && (
        <Alert variant="destructive">
          <IconAlertCircle />
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.user}>ELLIGBLE ID</Label>
        <Input id={ids.user} name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus
          value={username} onChange={e => setUsername(e.target.value)}
          aria-invalid={errors.username ? true : undefined} aria-describedby={errors.username ? ids.userErr : undefined} />
        {errors.username && <p id={ids.userErr} className="m-0 text-sm text-danger-ink">{errors.username}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.code}>Kode Pemulihan</Label>
        <Input id={ids.code} name="recovery-code" autoComplete="one-time-code" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          placeholder="XXXX-XXXX-XXXX" value={code} onChange={e => setCode(e.target.value)} className="font-mono tracking-wider"
          aria-invalid={errors.code ? true : undefined} aria-describedby={errors.code ? ids.codeErr : undefined} />
        {errors.code && <p id={ids.codeErr} className="m-0 text-sm text-danger-ink">{errors.code}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.pass}>Kata Sandi Baru</Label>
        <div className="relative">
          <Input id={ids.pass} name="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)} className="pr-12"
            aria-invalid={errors.password ? true : undefined} aria-describedby={errors.password ? `${ids.hint} ${ids.passErr}` : ids.hint} />
          <button type="button" onClick={() => setShowPassword(v => !v)}
            className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword}>
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>
        <p id={ids.hint} className="m-0 text-sm text-muted-foreground">
          Minimal 8 karakter. Setelah berhasil, semua perangkat lain yang masih masuk dengan akun ini akan keluar.
        </p>
        {errors.password && <p id={ids.passErr} className="m-0 text-sm text-danger-ink">{errors.password}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.confirm}>Ulangi Kata Sandi Baru</Label>
        <Input id={ids.confirm} name="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
          value={confirm} onChange={e => setConfirm(e.target.value)}
          aria-invalid={errors.confirm ? true : undefined} aria-describedby={errors.confirm ? ids.confirmErr : undefined} />
        {errors.confirm && <p id={ids.confirmErr} className="m-0 text-sm text-danger-ink">{errors.confirm}</p>}
      </div>
      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? 'Memulihkan...' : 'Pulihkan dan Masuk'}
      </Button>
    </form>
  );
};
