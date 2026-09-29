import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatDateTime, formatTime, formatWindow, getDisplayTimeZone, setDisplayTimeZone } from '../lib/format.ts';
import { App } from '../App.tsx';

// Exam times are shown in the school's time zone, whatever the device says (D04.2-36).

vi.mock('../api/assessment-client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client.ts')>('../api/assessment-client.ts');
  return {
    ...actual,
    getAssignedExams: vi.fn(async () => ({
      serverNow: '2026-09-29T23:30:00.000Z',
      assignments: [{
        examInstanceId: '33333333-3333-4333-8333-333333333333',
        subjectLabel: 'Fisika',
        roomLabel: null,
        schedule: { lifecycleState: 'SCHEDULED', windowStartsAt: '2026-09-30T00:00:00.000Z', windowEndsAt: '2026-09-30T02:00:00.000Z', attemptDurationSeconds: 5400 },
        attempts: [],
      }],
    })),
  };
});

vi.mock('../api/auth-client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/auth-client.ts')>('../api/auth-client.ts');
  return {
    ...actual,
    getSession: vi.fn(async () => ({
      status: 'authenticated',
      username: 'siswa.papua',
      expiresAt: '2099-01-01T00:00:00.000Z',
      memberships: [{ tenantId: '44444444-4444-4444-8444-444444444444', displayLabel: 'SMA Negeri 1 Jayapura' }],
    })),
    getMeContext: vi.fn(async () => ({
      tenantId: '44444444-4444-4444-8444-444444444444',
      tenantDisplayLabel: 'SMA Negeri 1 Jayapura',
      tenantTimeZone: 'Asia/Jayapura',
      capabilities: { examParticipant: true, proctor: false, teacher: false },
    })),
  };
});

describe('school time zone', () => {
  afterEach(() => setDisplayTimeZone(null));

  it('formats in the school zone with its Indonesian abbreviation', () => {
    const instant = '2026-09-30T01:00:00.000Z';
    setDisplayTimeZone('Asia/Jakarta');
    expect(formatTime(instant)).toBe('08.00 WIB');
    setDisplayTimeZone('Asia/Makassar');
    expect(formatTime(instant)).toBe('09.00 WITA');
    setDisplayTimeZone('Asia/Jayapura');
    expect(formatTime(instant)).toBe('10.00 WIT');
    expect(formatDateTime(instant)).toContain('30 September 2026');
  });

  it('uses the school date when the window crosses midnight elsewhere', () => {
    // 23.30 to 01.30 UTC is 06.30 to 08.30 WIB on the same school day.
    setDisplayTimeZone('Asia/Jakarta');
    expect(formatWindow('2026-09-29T23:30:00.000Z', '2026-09-30T01:30:00.000Z')).toBe('30 September 2026, 06.30 sampai 08.30 WIB');
  });

  it('keeps the device zone until a valid school zone is known', () => {
    setDisplayTimeZone('Mars/Olympus');
    expect(getDisplayTimeZone()).toBeUndefined();
    expect(() => formatTime('2026-09-30T01:00:00.000Z')).not.toThrow();
    setDisplayTimeZone(null);
    expect(getDisplayTimeZone()).toBeUndefined();
  });

  it('the app shows a school in WIT in WIT', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    expect(await screen.findByText('Fisika')).toBeTruthy();
    expect(getDisplayTimeZone()).toBe('Asia/Jayapura');
    expect(screen.getByText(/30 September 2026, 09\.00 sampai 11\.00 WIT/)).toBeTruthy();
  });
});
