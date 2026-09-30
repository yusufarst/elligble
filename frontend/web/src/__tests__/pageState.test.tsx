import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EmptyState, LoadErrorState, LoadingState, PageStateFrame, StaleDataNotice } from '@/components/ui/page-state';

// One loading, error, empty and stale-data pattern for every screen (plan §10.1.6, UI-SYSTEM-003
// part 2; FRONTEND_DESIGN_SYSTEM §31, §33, §34).

describe('shared page states', () => {
  it('announces loading as a line, not a blocking card', () => {
    render(<LoadingState>Memuat daftar ujian...</LoadingState>);
    const line = screen.getByRole('status');
    expect(line.textContent).toBe('Memuat daftar ujian...');
    expect(line.tagName).toBe('P');
  });

  it('says a load failed and offers "Coba Lagi", held while retrying', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<LoadErrorState kind="failed" title="Gagal Memuat Daftar Ujian" onRetry={onRetry}>Periksa koneksi internet Anda, lalu coba lagi.</LoadErrorState>);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-state')).toBe('load-error');
    expect(alert.textContent).toContain('Gagal Memuat Daftar Ujian');
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(<LoadErrorState kind="failed" title="Gagal Memuat Daftar Ujian" onRetry={onRetry} retrying>Periksa koneksi internet Anda, lalu coba lagi.</LoadErrorState>);
    expect((screen.getByRole('button', { name: 'Coba Lagi' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers no retry for a refusal, where it cannot help', () => {
    render(<LoadErrorState kind="refused" title="Akses Ditolak" onRetry={() => {}}>Anda tidak memiliki hak akses.</LoadErrorState>);
    expect(screen.getByText('Akses Ditolak')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the way back and the page heading above a state (audit M13)', () => {
    render(
      <PageStateFrame title="Hasil Ujian" back={<button type="button">Kembali ke Pelaksanaan Ujian</button>}>
        <LoadingState>Memuat hasil ujian...</LoadingState>
      </PageStateFrame>,
    );
    const page = screen.getByRole('main');
    const heading = screen.getByRole('heading', { level: 1, name: 'Hasil Ujian' });
    const order = [screen.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }), heading, screen.getByRole('status')];
    expect(order.every(el => page.contains(el))).toBe(true);
    expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order[1].compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows an empty page with a heading, one line and an optional action', () => {
    render(<EmptyState title="Belum Ada Ujian Terjadwal" action={<button type="button">Buat Ujian</button>}>Anda belum memiliki ujian yang dijadwalkan saat ini.</EmptyState>);
    expect(screen.getByRole('heading', { level: 2, name: 'Belum Ada Ujian Terjadwal' })).toBeTruthy();
    expect(screen.getByText('Anda belum memiliki ujian yang dijadwalkan saat ini.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buat Ujian' })).toBeTruthy();
  });

  it('keeps the last data visible with a notice when a refresh fails', () => {
    const { rerender } = render(<StaleDataNotice />);
    expect(screen.getByText('Gagal memperbarui data')).toBeTruthy();
    expect(screen.getByText('Data yang tampil adalah data terakhir.')).toBeTruthy();
    rerender(<StaleDataNotice title="Pemantauan tertunda">Data di bawah adalah data terakhir pukul 08.14.07 WIB.</StaleDataNotice>);
    expect(screen.getByText('Pemantauan tertunda')).toBeTruthy();
    expect(screen.getByRole('alert').getAttribute('data-state')).toBe('stale-data');
  });
});
