import React, { Suspense } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScreenLoadBoundary, ScreenLoading, onDemand } from '../components/ScreenLoadBoundary.tsx';

// Screens loaded on demand (WEB-001): while one downloads, and when it cannot be downloaded, the
// page shows the screen's heading and the shared loading or failed-load state instead of an
// empty page; "Coba Lagi" loads the page again. Any other error is not a download failure and
// is not dressed up as one.

function inBoundary(children: React.ReactNode) {
  return (
    <ScreenLoadBoundary title="Pemantauan Peserta">
      <Suspense fallback={<ScreenLoading title="Pemantauan Peserta" />}>{children}</Suspense>
    </ScreenLoadBoundary>
  );
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('screen load boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('says a screen could not be downloaded and reloads on "Coba Lagi"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location);
    const Unreachable = onDemand<object>(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    render(inBoundary(<Unreachable />));
    expect(await screen.findByText('Gagal Memuat Halaman')).toBeTruthy();
    expect(screen.getByText('Periksa koneksi internet Anda, lalu coba lagi.')).toBeTruthy();
    expect(heading()).toBe('Pemantauan Peserta');
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the screen once it is downloaded', async () => {
    const Monitoring = onDemand(() => Promise.resolve(({ title }: { title: string }) => <h1>{title}</h1>));
    render(inBoundary(<Monitoring title="Pelaksanaan Ujian" />));
    expect(screen.getByRole('status').textContent).toBe('Memuat halaman...');
    expect(heading()).toBe('Pemantauan Peserta');
    expect(await screen.findByRole('heading', { name: 'Pelaksanaan Ujian' })).toBeTruthy();
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });

  it('does not turn an error of the screen itself into a download failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Broken: React.FC = () => {
      throw new Error('render failed');
    };
    expect(() => render(inBoundary(<Broken />))).toThrow('render failed');
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });
});
