import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CenteredPage } from '@/components/ui/status-page';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconAlertCircle, IconInfo } from '@/components/icons';
import { newActionKey } from '../lib/action-key.ts';
import { ClaimApiError, submitClaim } from '../api/identity-client.ts';

// AUTH-002 public, non-trusted Student claim (record §7). Submitting creates no account, no
// password and no session; the school verifies the Student in person. The form never tells
// whether the data matched the roster. Entered data lives only in component memory and is
// cleared on success, cancellation and unmount; a late response cannot bring it back.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const FAILURE_COPY: Record<string, string> = {
  invalid_request: 'Data pengajuan belum sesuai. Periksa kembali isian Anda.',
  busy: 'Pengajuan untuk data ini sedang diproses. Coba lagi beberapa saat lagi.',
  too_many_requests: 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.',
};
const FALLBACK_FAILURE = 'Pengajuan belum diterima server. Periksa koneksi lalu kirim ulang.';

interface Fields { school: string; name: string; nisn: string; birth: string }
type FieldErrors = Partial<Record<keyof Fields, string>>;

export interface StudentClaimViewProps {
  /** School code from the school's own claim link; never a trust input. */
  initialTenantId: string | null;
  onBack(): void;
}

export const StudentClaimView: React.FC<StudentClaimViewProps> = ({ initialTenantId, onBack }) => {
  const presetSchool = initialTenantId && UUID.test(initialTenantId) ? initialTenantId : null;
  const empty: Fields = { school: presetSchool ?? '', name: '', nisn: '', birth: '' };
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [received, setReceived] = useState(false);
  const intent = useRef<string | null>(null);
  const generation = useRef(0);
  const statusRef = useRef<HTMLDivElement>(null);
  const ids = { school: useId(), name: useId(), nisn: useId(), birth: useId(), schoolHelp: useId(), nisnHelp: useId() };

  useEffect(() => () => { generation.current++; intent.current = null; }, []);
  useEffect(() => { if (received) statusRef.current?.focus(); }, [received]);

  const update = (key: keyof Fields, value: string) => {
    // A changed intent is a new request; an unchanged retry keeps its key.
    intent.current = null;
    setFailure(null);
    setFields(current => ({ ...current, [key]: value }));
  };

  const cancel = () => {
    generation.current++;
    intent.current = null;
    setFields(empty);
    onBack();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const next: FieldErrors = {};
    if (!UUID.test(fields.school.trim())) next.school = 'Kode sekolah tidak valid. Gunakan kode atau tautan dari sekolah Anda.';
    if (!fields.name.trim()) next.name = 'Nama lengkap wajib diisi.';
    else if ([...fields.name].length > 200) next.name = 'Nama lengkap terlalu panjang.';
    if (!fields.nisn.trim()) next.nisn = 'NISN wajib diisi.';
    else if (fields.nisn.trim().length > 64) next.nisn = 'NISN terlalu panjang.';
    if (!DATE.test(fields.birth)) next.birth = 'Tanggal lahir wajib diisi.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    intent.current ??= newActionKey();
    const current = generation.current;
    setSubmitting(true);
    setFailure(null);
    try {
      await submitClaim({
        tenantId: fields.school.trim().toLowerCase(), fullName: fields.name.trim(), nisn: fields.nisn.trim(),
        birthDate: fields.birth, requestKey: intent.current,
      });
      if (current !== generation.current) return;
      intent.current = null;
      setFields(empty);
      setReceived(true);
    } catch (error) {
      if (current !== generation.current) return;
      const code = error instanceof ClaimApiError ? error.code : '';
      setFailure(FAILURE_COPY[code] ?? FALLBACK_FAILURE);
    } finally {
      if (current === generation.current) setSubmitting(false);
    }
  };

  return (
    <CenteredPage>
      <p className="mb-6 text-center font-mono text-sm font-semibold tracking-[0.2em] text-foreground">ELLIGBLE</p>
      <Card id="student-claim">
        <CardHeader>
          <CardTitle level="h1">Ajukan Pendaftaran Akun</CardTitle>
          <CardDescription>
            Isi data sesuai daftar resmi sekolah. Pengajuan ini belum membuat akun. Wali kelas atau operator sekolah akan memverifikasi Anda secara langsung.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {received ? (
            <div ref={statusRef} tabIndex={-1} role="status" className="flex flex-col gap-4 outline-none">
              <Alert variant="info">
                <IconInfo />
                <AlertDescription>
                  Pengajuan sudah dikirim. Temui wali kelas atau operator sekolah dengan membawa kartu pelajar untuk verifikasi langsung dalam 7 hari. Setelah disetujui, petugas sekolah memberikan ELLIGBLE ID dan kode aktivasi kepada Anda secara langsung.
                </AlertDescription>
              </Alert>
              <Button variant="secondary" onClick={onBack}>Kembali ke halaman masuk</Button>
            </div>
          ) : (
            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={submitting}>
              {presetSchool === null && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.school}>Kode Sekolah</Label>
                  <Input id={ids.school} value={fields.school} autoComplete="off" spellCheck={false} disabled={submitting}
                    aria-invalid={Boolean(errors.school)} aria-describedby={ids.schoolHelp} onChange={e => update('school', e.target.value)} />
                  <p id={ids.schoolHelp} className={errors.school ? 'm-0 text-sm text-danger-ink' : 'm-0 text-sm text-muted-foreground'}>
                    {errors.school ?? 'Kode diberikan oleh sekolah Anda bersama tautan pendaftaran.'}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={ids.name}>Nama Lengkap</Label>
                <Input id={ids.name} value={fields.name} autoComplete="off" disabled={submitting} aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${ids.name}-error` : undefined} onChange={e => update('name', e.target.value)} />
                {errors.name && <p id={`${ids.name}-error`} className="m-0 text-sm text-danger-ink">{errors.name}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={ids.nisn}>NISN</Label>
                <Input id={ids.nisn} value={fields.nisn} inputMode="numeric" autoComplete="off" spellCheck={false} disabled={submitting}
                  aria-invalid={Boolean(errors.nisn)} aria-describedby={ids.nisnHelp} onChange={e => update('nisn', e.target.value)} />
                <p id={ids.nisnHelp} className={errors.nisn ? 'm-0 text-sm text-danger-ink' : 'm-0 text-sm text-muted-foreground'}>
                  {errors.nisn ?? 'Tulis lengkap termasuk angka nol di depan.'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={ids.birth}>Tanggal Lahir</Label>
                <Input id={ids.birth} type="date" value={fields.birth} disabled={submitting} aria-invalid={Boolean(errors.birth)}
                  aria-describedby={errors.birth ? `${ids.birth}-error` : undefined} onChange={e => update('birth', e.target.value)} />
                {errors.birth && <p id={`${ids.birth}-error`} className="m-0 text-sm text-danger-ink">{errors.birth}</p>}
              </div>
              {failure && (
                <Alert variant="destructive" role="alert">
                  <IconAlertCircle />
                  <AlertDescription>{failure}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={submitting}>{submitting ? 'Mengirim...' : failure ? 'Kirim Ulang Pengajuan' : 'Kirim Pengajuan'}</Button>
              <Button type="button" variant="secondary" disabled={submitting} onClick={cancel}>Batal</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
        Pengajuan tidak meminta kata sandi. Petugas sekolah tidak pernah meminta kata sandi Anda.
      </p>
    </CenteredPage>
  );
};
