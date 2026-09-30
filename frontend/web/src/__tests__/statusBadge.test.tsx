import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/ui/status-badge';
import { CANCELLED_EXAM_STATUS, LOCKED_PARTICIPANT_STATUS, SUBMITTED_ATTEMPT_STATUS, examLifecycleStatus, participantStatus, resultStatus } from '../lib/status.ts';

// One status language for every role (plan §10.1.7, UI-SYSTEM-003): a state has one word and
// one tone wherever it appears; a running exam and a working participant once had different
// tones on the teacher, monitoring and results screens.

describe('status badge', () => {
  it('shows the word with its tone', () => {
    render(<StatusBadge tone="active">Berlangsung</StatusBadge>);
    const badge = screen.getByText('Berlangsung');
    expect(badge.getAttribute('data-slot')).toBe('status-badge');
    expect(badge.getAttribute('data-tone')).toBe('active');
    expect(badge.className).toContain('bg-active-surface');
    expect(badge.className).toContain('rounded-full');
  });

  it('is neutral unless told otherwise', () => {
    render(<StatusBadge>Ruang: 10</StatusBadge>);
    expect(screen.getByText('Ruang: 10').getAttribute('data-tone')).toBe('neutral');
  });
});

describe('status words and tones', () => {
  it('running now is "active" for the exam, the working participant and the results alike', () => {
    expect(examLifecycleStatus('ACTIVE')).toEqual({ label: 'Berlangsung', tone: 'active' });
    expect(participantStatus({ status: 'ACTIVE', finalizationSource: null })).toEqual({ label: 'Mengerjakan', tone: 'active' });
    expect(resultStatus({ status: 'IN_PROGRESS', finalizationSource: null })).toEqual({ label: 'Sedang mengerjakan', tone: 'active' });
  });

  it('a submission reads and looks the same in monitoring and in the results', () => {
    for (const finalizationSource of [null, 'STUDENT_SUBMIT', 'EXPIRY_CLIENT', 'EXPIRY_SERVER'] as const) {
      expect(participantStatus({ status: 'SUBMITTED', finalizationSource })).toEqual(resultStatus({ status: 'SUBMITTED', finalizationSource }));
    }
    expect(resultStatus({ status: 'SUBMITTED', finalizationSource: 'STUDENT_SUBMIT' }).tone).toBe('success');
    expect(resultStatus({ status: 'SUBMITTED', finalizationSource: 'EXPIRY_SERVER' })).toEqual({ label: 'Dikumpulkan otomatis', tone: 'neutral' });
    expect(SUBMITTED_ATTEMPT_STATUS.tone).toBe('success');
  });

  it('gives each state its semantic tone (FRONTEND_DESIGN_SYSTEM §27)', () => {
    expect(participantStatus({ status: 'TIME_UP', finalizationSource: null })).toEqual({ label: 'Waktu habis', tone: 'danger' });
    expect(examLifecycleStatus('PAUSED').tone).toBe('warning');
    expect(LOCKED_PARTICIPANT_STATUS).toEqual({ label: 'Dikunci', tone: 'warning' });
    expect(examLifecycleStatus('READY').tone).toBe('info');
    expect(examLifecycleStatus('FINALIZED').tone).toBe('success');
    for (const state of ['SCHEDULED', 'ENDED', 'ARCHIVED']) expect(examLifecycleStatus(state).tone).toBe('neutral');
    expect(CANCELLED_EXAM_STATUS.tone).toBe('neutral');
    expect(participantStatus({ status: 'NOT_STARTED', finalizationSource: null }).tone).toBe('neutral');
    expect(resultStatus({ status: 'ABSENT', finalizationSource: null }).tone).toBe('neutral');
  });

  it('never shows a stored state name', () => {
    for (const state of ['SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED']) {
      expect(examLifecycleStatus(state).label).not.toMatch(/^[A-Z_]+$/);
    }
  });
});
