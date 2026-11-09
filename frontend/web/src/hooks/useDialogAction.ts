import { useEffect, useRef } from 'react';
import { newActionKey } from '../lib/action-key.ts';

// The dialog hooks of the School Operator screens ("Ujian Sekolah", "Ruang dan Pengawas"), shared so both
// behave alike (plan §10.1; moved unchanged from InstitutionExamView, ASSESS-INSTITUTION-002 E15).

/** A dialog form with one action key per opening, kept on every retry of it. */
export function useActionKey(open: boolean) {
  const key = useRef<string>('');
  useEffect(() => {
    if (open) key.current = newActionKey();
  }, [open]);
  return key;
}

/**
 * Sending disables the focused action. Restore focus to the enabled retry control only after the
 * error and that control have both committed to the dialog (as TeacherExamParticipants).
 */
export function useRetryFocus(open: boolean, errors: string[], saving: boolean) {
  const retry = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open && errors.length > 0 && !saving && retry.current && !retry.current.disabled) retry.current.focus();
  }, [open, errors, saving]);
  return retry;
}
