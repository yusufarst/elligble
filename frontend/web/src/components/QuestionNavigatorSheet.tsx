import React, { useEffect, useRef } from 'react';
import type { StudentSafeQuestion, SaveState } from '../types/assessment.ts';

export interface QuestionNavigatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  questions: StudentSafeQuestion[];
  currentIndex: number;
  selectedOptions: Record<string, string>;
  saveStates: Record<string, SaveState>;
  onSelectQuestion: (index: number) => void;
  onOpenSubmitModal: () => void;
  hasUnresolvedSaves: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const QuestionNavigatorSheet: React.FC<QuestionNavigatorSheetProps> = ({
  isOpen,
  onClose,
  questions,
  currentIndex,
  selectedOptions,
  saveStates,
  onSelectQuestion,
  onOpenSubmitModal,
  hasUnresolvedSaves,
  triggerRef,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus management: save activeElement on open, focus close button, restore focus on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    }
  }, [isOpen, triggerRef]);

  // Trap focus and close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!sheetRef.current) return;
        const focusableElements = sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"]):not(:disabled)'
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalQuestions = questions.length;
  const answeredCount = questions.filter(q => !!selectedOptions[q.snapshotId]).length;
  const unansweredCount = totalQuestions - answeredCount;

  const handleSelect = (idx: number) => {
    onSelectQuestion(idx);
    onClose();
  };

  const handleOpenSubmit = () => {
    onClose();
    onOpenSubmitModal();
  };

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="navigator-sheet-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2 id="navigator-sheet-title" className="sheet-title">
            Daftar Soal
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label="Tutup daftar soal"
          >
            Tutup
          </button>
        </div>

        <div className="sheet-summary-box">
          <div className="sheet-summary-item">
            <span className="summary-label">Total Soal:</span>
            <strong className="summary-val">{totalQuestions}</strong>
          </div>
          <div className="sheet-summary-item">
            <span className="summary-label">Sudah Dijawab:</span>
            <strong className="summary-val answered-accent">{answeredCount}</strong>
          </div>
          <div className="sheet-summary-item">
            <span className="summary-label">Belum Dijawab:</span>
            <strong className="summary-val">{unansweredCount}</strong>
          </div>
        </div>

        <div className="sheet-legend" aria-hidden="true">
          <span className="legend-chip"><span className="chip-indicator active-dot">•</span> Aktif</span>
          <span className="legend-chip"><span className="chip-indicator answered-dot">✓</span> Terjawab</span>
          <span className="legend-chip"><span className="chip-indicator unanswered-dot">○</span> Kosong</span>
          <span className="legend-chip"><span className="chip-indicator unresolved-dot">!</span> Proses</span>
        </div>

        <div className="sheet-grid" role="group" aria-label="Pilihan Nomor Soal">
          {questions.map((q, idx) => {
            const isAnswered = !!selectedOptions[q.snapshotId];
            const isCurrent = idx === currentIndex;
            const qState = saveStates[q.snapshotId];
            const isUnresolved = qState?.status === 'saving' || qState?.status === 'failed';

            let statusText = isAnswered ? 'sudah dijawab' : 'belum dijawab';
            if (isUnresolved) statusText = 'sedang disinkronisasi atau gagal';

            return (
              <button
                key={q.snapshotId}
                type="button"
                className={`sheet-nav-btn ${isCurrent ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isUnresolved ? 'unresolved' : ''}`}
                onClick={() => handleSelect(idx)}
                aria-label={`Pindah ke soal nomor ${idx + 1}, status ${statusText}`}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span className="sheet-btn-num">{idx + 1}</span>
                {isCurrent && <span className="sheet-btn-marker current-marker" aria-hidden="true">•</span>}
                {isAnswered && !isUnresolved && <span className="sheet-btn-marker answered-marker" aria-hidden="true">✓</span>}
                {isUnresolved && <span className="sheet-btn-marker unresolved-marker" aria-hidden="true">!</span>}
              </button>
            );
          })}
        </div>

        <div className="sheet-footer-action">
          <button
            type="button"
            className="btn btn-primary sheet-submit-btn"
            onClick={handleOpenSubmit}
            disabled={hasUnresolvedSaves}
            aria-haspopup="dialog"
          >
            Selesaikan Ujian
          </button>
        </div>
      </div>
    </div>
  );
};
