import { describe, it, expect } from 'vitest';
import { ServerClock } from '../exam/server-clock.ts';

// Server-anchored capture times (Owner decision 2026-09-30, point 9): the device clock may be
// wrong; the offset comes from server responses, the shortest round trip wins, and the
// estimate survives a reload.

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('ServerClock', () => {
  it('uses the device clock until the server has answered', () => {
    const clock = new ServerClock({ deviceNow: () => 5_000, storage: null });
    expect(clock.now()).toBe(5_000);
    expect(clock.offsetMs).toBeNull();
  });

  it('estimates the offset from the middle of the round trip and prefers the shortest round trip', () => {
    let device = 100_000;
    const clock = new ServerClock({ deviceNow: () => device, storage: null });
    // Device clock is 60 s behind the server; 400 ms round trip.
    clock.observe(new Date(160_200).toISOString(), 100_000, 100_400);
    expect(clock.offsetMs).toBe(60_000);
    // A slower answer with a skewed estimate does not replace it.
    clock.observe(new Date(163_000).toISOString(), 101_000, 103_000);
    expect(clock.offsetMs).toBe(60_000);
    // A faster one does.
    clock.observe(new Date(164_110).toISOString(), 104_000, 104_020);
    expect(clock.offsetMs).toBe(60_100);
    device = 200_000;
    expect(clock.now()).toBe(260_100);
  });

  it('ignores unusable samples', () => {
    const clock = new ServerClock({ deviceNow: () => 1_000, storage: null });
    clock.observe(undefined, 0, 10);
    clock.observe('bukan-waktu', 0, 10);
    clock.observe(new Date(5_000).toISOString(), 10, 0);
    clock.observe(new Date(5_000).toISOString(), 0, 120_000);
    expect(clock.offsetMs).toBeNull();
  });

  it('keeps the estimate on the device for a reload while offline', () => {
    const storage = memoryStorage();
    const first = new ServerClock({ deviceNow: () => 100_000, storage });
    first.observe(new Date(130_050).toISOString(), 100_000, 100_100);
    const second = new ServerClock({ deviceNow: () => 200_000, storage });
    expect(second.offsetMs).toBe(30_000);
    expect(second.now()).toBe(230_000);

    const muchLater = new ServerClock({ deviceNow: () => 100_000 + 13 * 60 * 60 * 1000, storage });
    expect(muchLater.offsetMs).toBeNull();
  });
});
