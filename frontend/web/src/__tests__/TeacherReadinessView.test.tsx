import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import { getTeacherReadiness, ApiError } from '../api/assessment-client';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return {
    ...actual,
    getTeacherReadiness: vi.fn(),
  };
});

describe('TeacherReadinessView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(getTeacherReadiness).mockReturnValue(new Promise(() => {}));
    render(<TeacherReadinessView />);
    expect(screen.getByText('Memuat data kesiapan ujian...')).toBeTruthy();
  });

  it('renders error state on 403', async () => {
    vi.mocked(getTeacherReadiness).mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<TeacherReadinessView />);
    
    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak')).toBeTruthy();
    });
  });

  it('renders empty state when no exams', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [] });
    render(<TeacherReadinessView />);
    
    await waitFor(() => {
      expect(screen.getByText('Tidak Ada Ujian Terjadwal')).toBeTruthy();
    });
  });

  it('renders exam readiness correctly', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [
        {
          examInstanceId: 'inst-1',
          subjectLabel: 'Math',
          baseline: { type: 'baseline_readiness_checks_pass', examInstanceId: 'inst-1', tenantId: 't1' },
          roomProctor: { type: 'room_proctor_readiness_not_applicable', roomBasedOperationsEnabled: false, proctorPerRoomRequired: false }
        }
      ]
    });
    
    render(<TeacherReadinessView />);
    
    await waitFor(() => {
      expect(screen.getByText('Math')).toBeTruthy();
      expect(screen.getByText('SIAP')).toBeTruthy();
    });
  });
});
