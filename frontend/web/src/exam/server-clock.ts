// Server-anchored time for answer capture stamps (Owner decision 2026-09-30, point 9). The
// server decides whether an answer was chosen before an exam pause from the capture time
// the device declares, so that time must follow the server's clock, not a device clock that
// may be wrong or changed. Every server response that carries its time gives an estimate of
// the offset (the server time against the middle of the round trip); the estimate from the
// shortest recent round trip wins, because its error is at most half that round trip. The
// estimate is kept on the device so a reload while offline still stamps with it.

export interface ClockSample {
  offsetMs: number;
  roundTripMs: number;
  observedAt: number;
}

const STORAGE_KEY = 'elligble.serverClock';
const MAX_SAMPLES = 8;
const SAMPLE_MAX_AGE_MS = 15 * 60 * 1000;
const STORED_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_ROUND_TRIP_MS = 60 * 1000;

function defaultStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class ServerClock {
  private samples: ClockSample[] = [];
  private readonly deviceNow: () => number;
  private readonly storage: Storage | null;

  constructor(options: { deviceNow?: () => number; storage?: Storage | null } = {}) {
    this.deviceNow = options.deviceNow ?? (() => Date.now());
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    try {
      const stored = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null') as ClockSample | null;
      if (stored && Number.isFinite(stored.offsetMs) && Number.isFinite(stored.roundTripMs) && Number.isFinite(stored.observedAt)
        && this.deviceNow() - stored.observedAt < STORED_MAX_AGE_MS) {
        this.samples = [stored];
      }
    } catch {
      // No stored estimate: the device clock is used until the server answers.
    }
  }

  /** Records one server time seen in a response; sentAt and receivedAt are device times around the request. */
  observe(serverTime: string | null | undefined, sentAt: number, receivedAt: number): void {
    if (!serverTime) return;
    const server = Date.parse(serverTime);
    const roundTripMs = receivedAt - sentAt;
    if (!Number.isFinite(server) || roundTripMs < 0 || roundTripMs > MAX_ROUND_TRIP_MS) return;
    const sample: ClockSample = { offsetMs: server - (sentAt + roundTripMs / 2), roundTripMs, observedAt: receivedAt };
    const fresh = this.samples.filter(s => receivedAt - s.observedAt < SAMPLE_MAX_AGE_MS);
    this.samples = [...fresh, sample].slice(-MAX_SAMPLES);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.best()));
    } catch {
      // Storage full or blocked: the estimate still holds for this page.
    }
  }

  private best(): ClockSample | null {
    let best: ClockSample | null = null;
    for (const s of this.samples) if (!best || s.roundTripMs < best.roundTripMs) best = s;
    return best;
  }

  /** Estimated server time now, in epoch milliseconds (the device clock until a sample exists). */
  now(): number {
    return this.deviceNow() + (this.best()?.offsetMs ?? 0);
  }

  get offsetMs(): number | null {
    return this.best()?.offsetMs ?? null;
  }
}

/** The page-wide clock used by the answer engine and the requests that report server time. */
export const serverClock = new ServerClock();

/** Runs a request and feeds the server time found in its JSON result into the clock. */
export async function observeServerTime<T extends { serverTime?: string | null }>(request: () => Promise<T>, clock: ServerClock = serverClock): Promise<T> {
  const sentAt = Date.now();
  const result = await request();
  clock.observe(result?.serverTime, sentAt, Date.now());
  return result;
}
