import React, { useState, useEffect, useRef } from 'react';

export interface SubmitConfirmModalProps {
  isOpen: boolean;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
  isOpen,
  totalQuestions,
  answeredCount,
  unansweredCount,
  isSubmitting,
  onCancel,
  onConfirm,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: focus cancel button when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Trap focus and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSubmitting) {
          onCancel();
        }
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={modalRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="modal-title">
          Konfirmasi Pengumpulan Ujian
        </h2>

        <div className="modal-summary-box">
          <div className="summary-row">
            <span>Total Soal:</span>
            <strong>{totalQuestions}</strong>
          </div>
          <div className="summary-row">
            <span>Sudah Dijawab:</span>
            <strong>{answeredCount}</strong>
          </div>
          <div className="summary-row">
            <span>Belum Dijawab:</span>
            <strong>{unansweredCount}</strong>
          </div>
        </div>

        <label className="modal-declaration">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={e => setIsChecked(e.target.checked)}
            disabled={isSubmitting}
            aria-label="Saya menyatakan telah memeriksa seluruh jawaban dan siap mengumpulkan ujian ini."
          />
          <span>
            Saya menyatakan telah memeriksa seluruh jawaban dan siap mengumpulkan ujian ini.
          </span>
        </label>

        <div className="modal-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={!isChecked || isSubmitting}
          >
            {isSubmitting ? 'Mengirimkan...' : 'Kirim Jawaban Sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
};
