// Time added by the teacher (ASSESS-PROCTOR-004, D04.6-41). Every timer answer carries the
// configured duration and the effective one; their difference is the time added so far.
// When it grows, the exam screen says so once. The largest amount already announced is
// remembered on the device, so a reload does not announce it again, and in memory, so a
// browser that refuses storage does not repeat it on every check. The reason for an
// addition never reaches the student.

const PREFIX = 'elligble.timeAdded.';
const announced = new Map<string, number>();

function defaultStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storedAmount(storage: Storage | null, attemptId: string): number | undefined {
  try {
    const raw = storage?.getItem(PREFIX + attemptId);
    if (raw === null || raw === undefined) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Seconds added since the last announcement for this attempt on this device (0 when
 * nothing new), recording `addedSeconds` as announced.
 */
export function takeNewlyAddedSeconds(attemptId: string, addedSeconds: number, storage: Storage | null = defaultStorage()): number {
  if (!attemptId || !Number.isFinite(addedSeconds)) return 0;
  const known = [announced.get(attemptId), storedAmount(storage, attemptId)].filter((v): v is number => v !== undefined);
  const fresh = addedSeconds - (known.length > 0 ? Math.max(...known) : 0);
  if (fresh <= 0) return 0;
  announced.set(attemptId, addedSeconds);
  try {
    storage?.setItem(PREFIX + attemptId, String(addedSeconds));
  } catch {
    // Storage full or blocked: memory still prevents a repeat on this page.
  }
  return fresh;
}

/** Forgets the announcements of a finished attempt on this device. */
export function clearAddedTime(attemptId: string, storage: Storage | null = defaultStorage()): void {
  announced.delete(attemptId);
  try {
    storage?.removeItem(PREFIX + attemptId);
  } catch {
    // Nothing to clean up.
  }
}

/** The student-facing line for newly added time. */
export function timeAddedMessage(seconds: number): string {
  return `Waktu pengerjaan Anda ditambah ${Math.max(1, Math.round(seconds / 60))} menit.`;
}
