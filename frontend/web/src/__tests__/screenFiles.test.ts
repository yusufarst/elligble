import { describe, it, expect, vi } from 'vitest';
import { ScreenLoadError, screenFiles } from '../lib/screen-files.ts';

// Screens downloaded on demand (WEB-001): one download for every caller; a failure stays until
// "Coba Lagi"; a retry asks under a new address, because an engine may answer the same address
// with the same failure without asking the server (WebKit, even after a reload: CI run 45).

const SCREENS = { name: 'staff screens' };
const ADDRESS = '/assets/staff-screens-AbC123.js';
const offline = (): Promise<typeof SCREENS> => Promise.reject(new TypeError('Importing a module script failed.'));

function files(overrides: Partial<Parameters<typeof screenFiles<typeof SCREENS>>[0]> = {}) {
  const load = vi.fn(() => Promise.resolve(SCREENS));
  const loadAddress = vi.fn((_url: string) => Promise.resolve(SCREENS));
  const check = vi.fn((_url: string) => Promise.resolve(new Response(null, { status: 200 })));
  const options = { load, address: () => ADDRESS, loadAddress, check, ...overrides };
  return { files: screenFiles(options), ...options };
}

describe('screens downloaded on demand', () => {
  it('downloads once for every caller', async () => {
    const { files: staff, load } = files();
    const first = staff.get();
    expect(staff.get()).toBe(first);
    expect(await first).toBe(SCREENS);
    expect(staff.get()).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed download until asked again, then asks under a new address each time', async () => {
    const load = vi.fn(offline);
    const loadAddress = vi.fn((_url: string) => offline());
    const { files: staff } = files({ load, loadAddress });
    const failed = staff.get();
    const reason = await failed.catch((e: unknown) => e);
    expect(reason).toBeInstanceOf(ScreenLoadError);
    expect((reason as ScreenLoadError).cause).toBeInstanceOf(TypeError);
    expect(staff.get()).toBe(failed);
    expect(load).toHaveBeenCalledTimes(1);

    staff.retry();
    await staff.get().catch(() => {});
    staff.retry();
    loadAddress.mockImplementationOnce(() => Promise.resolve(SCREENS));
    expect(await staff.get()).toBe(SCREENS);
    expect(loadAddress.mock.calls.map(([url]) => url)).toEqual([`${ADDRESS}?attempt=2`, `${ADDRESS}?attempt=3`]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not start again while a download is under way or once it succeeded', async () => {
    const { files: staff, load, loadAddress } = files();
    const first = staff.get();
    staff.retry();
    expect(staff.get()).toBe(first);
    await first;
    staff.retry();
    expect(staff.get()).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    expect(loadAddress).not.toHaveBeenCalled();
  });

  it('asks the bundler again where the build names no address (development, tests)', async () => {
    const load = vi.fn(offline);
    const { files: staff, loadAddress } = files({ load, address: () => null });
    await staff.get().catch(() => {});
    staff.retry();
    load.mockImplementationOnce(() => Promise.resolve(SCREENS));
    expect(await staff.get()).toBe(SCREENS);
    expect(load).toHaveBeenCalledTimes(2);
    expect(loadAddress).not.toHaveBeenCalled();
  });

  it('tells a file a release replaced (gone from the server) from one that could not be reached', async () => {
    const check = vi.fn((_url: string) => Promise.resolve(new Response(null, { status: 404 })));
    const { files: gone } = files({ check });
    expect(await gone.replaced()).toBe(true);
    expect(check).toHaveBeenCalledWith(ADDRESS);

    expect(await files().files.replaced()).toBe(false);
    // A server error while a release rolls out is not "gone": a reload could lose the page itself.
    expect(await files({ check: () => Promise.resolve(new Response(null, { status: 503 })) }).files.replaced()).toBe(false);
    expect(await files({ check: () => Promise.reject(new TypeError('Load failed')) }).files.replaced()).toBe(false);
    expect(await files({ address: () => null }).files.replaced()).toBe(false);
  });
});
