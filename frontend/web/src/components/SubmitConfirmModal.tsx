import React, { useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconAlertCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Metric, MetricList } from '@/components/ui/metric';

export interface SubmitConfirmModalProps {
  isOpen: boolean;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  /** Questions still marked "Ragu-ragu": a reminder only, submitting stays possible. */
  flaggedCount?: number;
  isSubmitting: boolean;
  /** Shown when the last submission request failed; the student can simply try again. */
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const DECLARATION = 'Saya menyatakan telah memeriksa seluruh jawaban dan siap mengumpulkan ujian ini.';

// The submit confirmation is the shared dialog (UI-SYSTEM-002, audit C2): focus starts on
// "Batal", Escape cancels unless the answers are being sent, a tap outside does nothing, and
// sending needs the declaration.
export const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
  isOpen,
  totalQuestions,
  answeredCount,
  unansweredCount,
  flaggedCount = 0,
  isSubmitting,
  errorMessage,
  onCancel,
  onConfirm,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) setIsChecked(false);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !isSubmitting) onCancel(); }}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        onOpenAutoFocus={event => {
          event.preventDefault();
          cancelButtonRef.current?.focus();
        }}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Konfirmasi Pengumpulan Ujian</DialogTitle>
        </DialogHeader>

        <MetricList className={flaggedCount > 0 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}>
          <Metric label="Total Soal" value={totalQuestions} />
          <Metric label="Sudah Dijawab" value={answeredCount} />
          <Metric label="Belum Dijawab" value={unansweredCount} />
          {flaggedCount > 0 && <Metric label="Ditandai Ragu-ragu" value={flaggedCount} />}
        </MetricList>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted px-3 py-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            checked={isChecked}
            onChange={e => setIsChecked(e.target.checked)}
            disabled={isSubmitting}
            aria-label={DECLARATION}
          />
          <span>{DECLARATION}</span>
        </label>

        {errorMessage && (
          <Alert variant="destructive">
            <IconAlertCircle aria-hidden="true" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button ref={cancelButtonRef} variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={onConfirm} disabled={!isChecked || isSubmitting}>
            {isSubmitting ? 'Mengirimkan...' : 'Kirim Jawaban Sekarang'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
