import React from 'react';
import { Button } from '@/components/ui/button';
import { IconEye, IconEyeOff } from '@/components/icons';

// The masked score and its reveal control (FRONTEND_DESIGN_SYSTEM §58: grade information is masked by default on
// shared screens). One shared pattern for the Teacher results and the Student's own published result (RESULT-003 E7a,
// plan §10.1), moved unchanged from TeacherResultsView, so the Student screen imports no Teacher screen. The reveal
// state belongs to the screen that renders the control: component state only, never stored.

/** The mask in place of a hidden value. */
export const HiddenScore: React.FC = () => (
  <span aria-label="Disembunyikan" className="tracking-widest text-muted-foreground">••••</span>
);

/** "Tampilkan Nilai" / "Sembunyikan Nilai", pressed while the values are shown. */
export const ScoreRevealToggle: React.FC<{ pressed: boolean; onToggle(): void; disabled?: boolean }> = ({ pressed, onToggle, disabled }) => (
  // At 200 % text on a phone the label wraps instead of widening the page (ASSESS-QUESTION-008 C07).
  <Button variant="secondary" className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left" aria-pressed={pressed} onClick={onToggle} disabled={disabled}>
    {pressed ? <IconEyeOff aria-hidden="true" /> : <IconEye aria-hidden="true" />}
    {pressed ? 'Sembunyikan Nilai' : 'Tampilkan Nilai'}
  </Button>
);
