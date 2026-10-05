import React, { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconAlertCircle, IconEye, IconEyeOff } from '@/components/icons';
import { LoginError } from '../api/auth-client.ts';

const FAILURE_COPY: Record<string, string> = {
  invalid_credentials: 'ELLIGBLE ID atau kata sandi tidak sesuai. Periksa kembali lalu coba lagi.',
  too_many_attempts: 'Terlalu banyak percobaan masuk. Tunggu beberapa menit sebelum mencoba lagi.',
  invalid_request: 'ELLIGBLE ID atau kata sandi tidak valid.',
  unavailable: 'Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.',
};

export interface LoginFormProps {
  onSubmit(username: string, password: string): Promise<void>;
  submitLabel?: string;
  autoFocus?: boolean;
  /** Locks the ELLIGBLE ID (re-authentication of the same account). */
  fixedUsername?: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, submitLabel = 'Masuk', autoFocus = true, fixedUsername = null }) => {
  const [username, setUsername] = useState(fixedUsername ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const ids = { user: useId(), pass: useId(), userErr: useId(), passErr: useId() };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) errors.username = 'ELLIGBLE ID wajib diisi.';
    if (!password) errors.password = 'Kata sandi wajib diisi.';
    setFieldErrors(errors);
    setFailure(null);
    if (errors.username || errors.password) return;

    setSubmitting(true);
    try {
      await onSubmit(username.trim(), password);
    } catch (err) {
      setFailure(FAILURE_COPY[err instanceof LoginError ? err.reason : 'unavailable']);
      setPassword('');
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
        <Input
          id={ids.user}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus && !fixedUsername}
          value={username}
          readOnly={Boolean(fixedUsername)}
          onChange={e => setUsername(e.target.value)}
          aria-invalid={fieldErrors.username ? true : undefined}
          aria-describedby={fieldErrors.username ? ids.userErr : undefined}
        />
        {fieldErrors.username && <p id={ids.userErr} className="m-0 text-sm text-danger-ink">{fieldErrors.username}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.pass}>Kata Sandi</Label>
        <div className="relative">
          <Input
            id={ids.pass}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus={autoFocus && Boolean(fixedUsername)}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="pr-12"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? ids.passErr : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            aria-pressed={showPassword}
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>
        {fieldErrors.password && <p id={ids.passErr} className="m-0 text-sm text-danger-ink">{fieldErrors.password}</p>}
      </div>
      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? 'Memverifikasi...' : submitLabel}
      </Button>
    </form>
  );
};
