import React, { Suspense } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// The teacher and proctor screens are one file downloaded on demand (WEB-001). While it
// downloads, and when it cannot be downloaded, the page shows the screen's heading and the
// shared loading or failed-load state instead of an empty page. "Coba Lagi" asks for the file
// again, or reloads the page when a release replaced it. Any other error is not a download
// failure and is not dressed up as one.

const download = { failures: 0, attempts: 0 };

/** A fresh copy of the module, so each test starts with the file not yet downloaded. */
async function boundaryModule() {
  vi.resetModules();
  vi.doMock('../staff-screens.ts', () => {
    download.attempts += 1;
    if (download.failures > 0) {
      download.failures -= 1;
      throw new TypeError('Importing a module script failed.');
    }
    return { ProctorMonitoringView: () => <p>Daftar pengawasan</p> };
  });
  return import('../components/ScreenLoadBoundary.tsx');
}

async function renderScreen() {
  const { ProctorMonitoringView, ScreenLoadBoundary, ScreenLoading } = await boundaryModule();
  render(
    <ScreenLoadBoundary title="Monitoring Ujian">
      <Suspense fallback={<ScreenLoading title="Monitoring Ujian" />}>
        <ProctorMonitoringView />
      </Suspense>
    </ScreenLoadBoundary>,
  );
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('screen load boundary', () => {
  beforeEach(() => {
    download.failures = 0;
    download.attempts = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.head.querySelector('meta[name="elligble-staff-screens"]')?.remove();
  });

  it('shows the heading and "Memuat halaman..." while the file downloads, then the screen', async () => {
    await renderScreen();
    expect(heading()).toBe('Monitoring Ujian');
    expect(screen.getByRole('status').textContent).toBe('Memuat halaman...');
    expect(await screen.findByText('Daftar pengawasan')).toBeTruthy();
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });

  it('says the file could not be downloaded, and "Coba Lagi" asks for it again', async () => {
    download.failures = 1;
    await renderScreen();
    expect(await screen.findByText('Gagal Memuat Halaman')).toBeTruthy();
    expect(screen.getByText('Periksa koneksi internet Anda, lalu coba lagi.')).toBeTruthy();
    expect(heading()).toBe('Monitoring Ujian');
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(await screen.findByText('Daftar pengawasan')).toBeTruthy();
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });

  it('keeps saying so while the file still cannot be downloaded', async () => {
    download.failures = 2;
    await renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Coba Lagi' }));
    // The second attempt failed too: the state is back, ready for another try.
    await vi.waitFor(() => expect(download.attempts).toBe(2));
    await vi.waitFor(() => expect((screen.getByRole('button', { name: 'Coba Lagi' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText('Gagal Memuat Halaman')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(await screen.findByText('Daftar pengawasan')).toBeTruthy();
    expect(download.attempts).toBe(3);
  });

  it('reloads the page when a release replaced the file', async () => {
    const meta = document.createElement('meta');
    meta.name = 'elligble-staff-screens';
    meta.content = '/assets/staff-screens-AbC123.js';
    document.head.append(meta);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location);
    download.failures = 1;
    await renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Coba Lagi' }));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/assets/staff-screens-AbC123.js', { method: 'HEAD', cache: 'no-store' });
  });

  it('does not turn an error of the screen itself into a download failure', async () => {
    const { ScreenLoadBoundary } = await boundaryModule();
    const Broken: React.FC = () => {
      throw new Error('render failed');
    };
    expect(() => render(<ScreenLoadBoundary title="Monitoring Ujian"><Broken /></ScreenLoadBoundary>)).toThrow('render failed');
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });
});
