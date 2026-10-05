import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    // The page keeps its heading; loading is an announced line (the shared pattern).
    expect(screen.getByRole('heading', { level: 1, name: 'Pelaksanaan Ujian' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Memuat daftar ujian...');
  });

  it('renders error state on 403 forbidden', async () => {
    vi.mocked(getTeacherReadiness).mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<TeacherReadinessView />);
    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak')).toBeTruthy();
    });
    // A refusal offers no retry that cannot help, and no action it would refuse too.
    expect(screen.queryByRole('button', { name: 'Coba Lagi' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Perbarui Data' })).toBeNull();
  });

  it('renders general API/network failure state', async () => {
    vi.mocked(getTeacherReadiness).mockRejectedValue(new Error('Network disconnected'));
    render(<TeacherReadinessView />);
    await waitFor(() => {
      expect(screen.getByText('Gagal Memuat Daftar Ujian')).toBeTruthy();
      expect(screen.getByText('Periksa koneksi internet Anda, lalu coba lagi.')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Coba Lagi' })).toBeTruthy();
  });

  it('keeps the exams on screen and says so when a refresh fails', async () => {
    vi.mocked(getTeacherReadiness)
      .mockResolvedValueOnce({ exams: [{ examInstanceId: 'inst-1', subjectLabel: 'Sejarah', baseline: { status: 'baseline_readiness_checks_pass' }, roomProctor: { status: 'room_proctor_readiness_ready' } }] })
      .mockRejectedValueOnce(new Error('Network disconnected'));
    render(<TeacherReadinessView />);
    await waitFor(() => expect(screen.getByText('Sejarah')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui Data' }));
    await waitFor(() => expect(screen.getByText('Gagal memperbarui data')).toBeTruthy());
    expect(screen.getByText('Data yang tampil adalah data terakhir.')).toBeTruthy();
    expect(screen.getByText('Sejarah')).toBeTruthy();
  });

  it('renders empty state when no exams', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [] });
    render(<TeacherReadinessView />);
    await waitFor(() => {
      expect(screen.getByText('Belum Ada Ujian Terjadwal')).toBeTruthy();
    });
  });

  it('renders one exam with baseline pass and room/proctor ready', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [
        {
          examInstanceId: 'inst-1',
          subjectLabel: 'Matematika',
          baseline: { status: 'baseline_readiness_checks_pass' },
          roomProctor: { status: 'room_proctor_readiness_ready' }
        }
      ]
    });

    render(<TeacherReadinessView />);

    await waitFor(() => {
      expect(screen.getByText('Matematika')).toBeTruthy();
      expect(screen.getByText('Kesiapan dasar terpenuhi')).toBeTruthy();
      expect(screen.getByText('Kesiapan ruangan dan pengawas terpenuhi')).toBeTruthy();
      expect(screen.queryByText('SIAP')).toBeNull();
      expect(screen.queryByText('BELUM SIAP')).toBeNull();
    });
  });

  it('renders multiple exams with diverse statuses including not applicable and blockers', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [
        {
          examInstanceId: 'inst-1',
          subjectLabel: 'Matematika',
          baseline: { status: 'baseline_readiness_checks_pass' },
          roomProctor: { status: 'room_proctor_readiness_not_applicable' }
        },
        {
          examInstanceId: 'inst-2',
          subjectLabel: 'Fisika',
          baseline: { status: 'not_ready', blocker: 'question_snapshot_empty' },
          roomProctor: { status: 'not_ready', blocker: 'active_proctor_assignment_empty' }
        }
      ]
    });

    render(<TeacherReadinessView />);

    await waitFor(() => {
      expect(screen.getByText('Matematika')).toBeTruthy();
      expect(screen.getByText('Pemeriksaan ruangan dan pengawas tidak berlaku untuk ujian ini')).toBeTruthy();

      expect(screen.getByText('Fisika')).toBeTruthy();
      expect(screen.getByText('Soal ujian belum ditambahkan')).toBeTruthy();
      expect(screen.getByText('Belum ada pengawas yang ditugaskan')).toBeTruthy();

      expect(screen.queryByText('SIAP')).toBeNull();
      expect(screen.queryByText('BELUM SIAP')).toBeNull();
    });
  });

  it('renders denied/unavailable/invalid state display', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [
        {
          examInstanceId: 'inst-1',
          subjectLabel: 'Kimia',
          baseline: { status: 'denied' },
          roomProctor: { status: 'unavailable' }
        },
        {
          examInstanceId: 'inst-2',
          subjectLabel: 'Biologi',
          baseline: { status: 'invalid_state' },
          roomProctor: { status: 'invalid_state' }
        }
      ]
    });

    render(<TeacherReadinessView />);

    await waitFor(() => {
      expect(screen.getByText('Kimia')).toBeTruthy();
      expect(screen.getByText('Status kesiapan dasar tidak dapat diakses')).toBeTruthy();
      expect(screen.getByText('Data ruangan dan pengawas sementara tidak tersedia')).toBeTruthy();

      expect(screen.getByText('Biologi')).toBeTruthy();
      expect(screen.getByText('Status ujian tidak mendukung pemeriksaan kesiapan dasar')).toBeTruthy();
      expect(screen.getByText('Status ujian tidak mendukung pemeriksaan ruangan dan pengawas')).toBeTruthy();
    });
  });

  it('provides null subject label fallback', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [
        {
          examInstanceId: 'inst-1',
          subjectLabel: null,
          baseline: { status: 'baseline_readiness_checks_pass' },
          roomProctor: { status: 'room_proctor_readiness_ready' }
        }
      ]
    });

    render(<TeacherReadinessView />);

    await waitFor(() => {
      expect(screen.getByText('Informasi mata pelajaran tidak tersedia')).toBeTruthy();
    });
  });

  it('supports manual refresh', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValueOnce({ exams: [] })
                                  .mockResolvedValueOnce({
                                    exams: [{
                                      examInstanceId: 'inst-1',
                                      subjectLabel: 'Sejarah',
                                      baseline: { status: 'baseline_readiness_checks_pass' },
                                      roomProctor: { status: 'room_proctor_readiness_ready' }
                                    }]
                                  });

    render(<TeacherReadinessView />);

    await waitFor(() => {
      expect(screen.getByText('Belum Ada Ujian Terjadwal')).toBeTruthy();
    });

    const refreshButton = screen.getByText('Perbarui Data');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('Sejarah')).toBeTruthy();
      expect(getTeacherReadiness).toHaveBeenCalledTimes(2);
    });
  });
});
