import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProctorMonitoringView } from '../components/ProctorMonitoringView.tsx';
import * as assessmentClient from '../api/assessment-client.ts';

vi.mock('../api/assessment-client.ts', () => ({
  getProctorMonitoring: vi.fn(),
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string) {
      super(code);
      this.status = status;
      this.code = code;
      this.name = 'ApiError';
    }
  }
}));

describe('ProctorMonitoringView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(assessmentClient.getProctorMonitoring).mockReturnValue(new Promise(() => {}));
    render(<ProctorMonitoringView />);
    // The page keeps its heading; loading is an announced line (the shared pattern).
    expect(screen.getByRole('heading', { level: 1, name: 'Monitoring Ujian' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Memuat daftar ujian...');
  });

  it('renders forbidden state when ApiError with status 403 is thrown', async () => {
    vi.mocked(assessmentClient.getProctorMonitoring).mockRejectedValue(new assessmentClient.ApiError(403, 'Forbidden'));
    render(<ProctorMonitoringView />);

    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak')).toBeDefined();
    });
    expect(screen.getByText(/Anda tidak memiliki hak akses untuk memonitoring ruangan/i)).toBeDefined();
    // A refusal offers no retry that cannot help, and no refresh.
    expect(screen.queryByRole('button', { name: 'Coba Lagi' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Perbarui Data' })).toBeNull();
  });

  it('renders API failure state on non-403 error', async () => {
    vi.mocked(assessmentClient.getProctorMonitoring).mockRejectedValue(new assessmentClient.ApiError(500, 'internal_error'));
    render(<ProctorMonitoringView />);

    await waitFor(() => {
      expect(screen.getByText('Gagal Memuat Daftar Ujian')).toBeDefined();
    });
    expect(screen.getByText('Periksa koneksi internet Anda, lalu coba lagi.')).toBeDefined();
    expect(screen.getByRole('alert').getAttribute('data-state')).toBe('load-error');
    expect(screen.getByRole('button', { name: 'Coba Lagi' })).toBeDefined();
  });

  it('renders empty state when assignments array is empty (no assignment)', async () => {
    vi.mocked(assessmentClient.getProctorMonitoring).mockResolvedValue({ assignments: [] });
    render(<ProctorMonitoringView />);

    await waitFor(() => {
      expect(screen.getByText('Belum Ada Ujian yang Diawasi')).toBeDefined();
    });
    expect(screen.getByText(/Anda belum ditugaskan untuk mengawasi ujian apa pun saat ini/i)).toBeDefined();
    expect(screen.getByText('Perbarui Data')).toBeDefined();
  });

  it('renders exam and room assignments (populated one/multiple rooms, zero rooms, and zero active sessions)', async () => {
    vi.mocked(assessmentClient.getProctorMonitoring).mockResolvedValue({
      assignments: [
        {
          examInstanceId: 'inst-1',
          subjectLabel: 'Matematika',
          rooms: [
            {
              roomId: 'room-1',
              roomLabel: 'Ruang 1',
              participantCount: 30,
              activeSessionCount: 25
            },
            {
              roomId: 'room-2',
              roomLabel: 'Ruang 2',
              participantCount: 20,
              activeSessionCount: 0
            }
          ]
        },
        {
          examInstanceId: 'inst-2',
          subjectLabel: 'Fisika',
          rooms: []
        }
      ]
    });

    render(<ProctorMonitoringView />);

    await waitFor(() => {
      expect(screen.getByText('Monitoring Ujian')).toBeDefined();
    });

    // Check titles
    expect(screen.getByText('Matematika')).toBeDefined();
    expect(screen.getByText('Fisika')).toBeDefined();

    // Check room labels
    expect(screen.getByText('Ruang 1')).toBeDefined();
    expect(screen.getByText('Ruang 2')).toBeDefined();

    // Check stats (Ruang 1 has 30 participants, Ruang 2 has 20)
    expect(screen.getByText('30')).toBeDefined();
    expect(screen.getByText('25')).toBeDefined();
    expect(screen.getByText('20')).toBeDefined();
    expect(screen.getByText('0')).toBeDefined(); // Ruang 2 active sessions

    // An exam without room operations lists no room cards; its participants open from "Lihat Peserta".
    expect(screen.queryByText('Tidak ada ruangan yang ditugaskan untuk ujian ini.')).toBeNull();
  });

  it('keeps the exams on screen and says so when a refresh fails', async () => {
    vi.mocked(assessmentClient.getProctorMonitoring)
      .mockResolvedValueOnce({ assignments: [{ examInstanceId: 'inst-1', subjectLabel: 'Kimia', rooms: [] }] })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<ProctorMonitoringView />);
    await waitFor(() => expect(screen.getByText('Kimia')).toBeDefined());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Perbarui Data' }));
    });
    await waitFor(() => expect(screen.getByText('Gagal memperbarui data')).toBeDefined());
    expect(screen.getByText('Data yang tampil adalah data terakhir.')).toBeDefined();
    expect(screen.getByText('Kimia')).toBeDefined();
  });

  it('handles manual refresh button click and updates data', async () => {
    vi.mocked(assessmentClient.getProctorMonitoring).mockResolvedValueOnce({ assignments: [] });
    render(<ProctorMonitoringView />);

    await waitFor(() => {
      expect(screen.getByText('Belum Ada Ujian yang Diawasi')).toBeDefined();
    });

    vi.mocked(assessmentClient.getProctorMonitoring).mockResolvedValueOnce({
      assignments: [
        {
          examInstanceId: 'inst-1',
          subjectLabel: 'Kimia',
          rooms: [
            {
              roomId: 'room-k1',
              roomLabel: 'Lab Kimia',
              participantCount: 15,
              activeSessionCount: 12
            }
          ]
        }
      ]
    });

    const refreshButton = screen.getByText('Perbarui Data');
    await act(async () => {
      fireEvent.click(refreshButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Kimia')).toBeDefined();
      expect(screen.getByText('Lab Kimia')).toBeDefined();
    });

    expect(assessmentClient.getProctorMonitoring).toHaveBeenCalledTimes(2);
  });
});
