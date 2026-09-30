import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, postReviewFlag, type ReviewFlagRequest } from '../api/assessment-client.ts';

// "Ragu-ragu / Tandai" marks for one attempt (D04.5-33/34/35): the student's own reminder to
// look at a question again before submitting. A mark never touches the answer and never
// blocks saving or submitting. It shows at once, is kept on this device until the server
// has it (so a reload does not lose it), and is sent in the background with retries; the
// server copy lets the marks follow the student to another device.

const RETRY_INITIAL_MS = 2000;
const RETRY_MAX_MS = 30000;

export interface UseReviewFlagsOptions {
  attemptId: string;
  /** This tab's own exam session id (its write capability). */
  sessionId: string;
  /** Marked question ids from resume; null until loaded. */
  initialFlags: string[] | null;
  enabled: boolean;
  /** Seams for tests. */
  send?: (req: ReviewFlagRequest) => Promise<unknown>;
  storage?: Storage | null;
}

export interface ReviewFlags {
  flags: Record<string, boolean>;
  toggle: (snapshotId: string) => void;
  flaggedCount: number;
}

function defaultStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storageKey = (attemptId: string) => `elligble.reviewFlags.${attemptId}`;

function without(pending: Record<string, boolean>, snapshotId: string): Record<string, boolean> {
  const rest = { ...pending };
  delete rest[snapshotId];
  return rest;
}

function readPending(storage: Storage | null, attemptId: string): Record<string, boolean> {
  try {
    const raw = storage?.getItem(storageKey(attemptId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
  } catch {
    return {};
  }
}

function writePending(storage: Storage | null, attemptId: string, pending: Record<string, boolean>): void {
  try {
    if (Object.keys(pending).length === 0) storage?.removeItem(storageKey(attemptId));
    else storage?.setItem(storageKey(attemptId), JSON.stringify(pending));
  } catch {
    // Storage full or unavailable: the mark still shows and is sent from memory.
  }
}

/** Drops this device's unsent marks of a finished attempt (shared devices). */
export function clearReviewFlags(attemptId: string, storage: Storage | null = defaultStorage()): void {
  try {
    storage?.removeItem(storageKey(attemptId));
  } catch {
    // Nothing to clear.
  }
}

export function useReviewFlags({
  attemptId,
  sessionId,
  initialFlags,
  enabled,
  send = postReviewFlag,
  storage = defaultStorage(),
}: UseReviewFlagsOptions): ReviewFlags {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const flagsRef = useRef<Record<string, boolean>>({});
  const pendingRef = useRef<Record<string, boolean>>({});
  const runningRef = useRef(false);
  const closedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(RETRY_INITIAL_MS);
  const optionsRef = useRef({ attemptId, sessionId, enabled, send, storage });
  optionsRef.current = { attemptId, sessionId, enabled, send, storage };

  const flush = useCallback(async (): Promise<void> => {
    const { attemptId: id, sessionId: session, enabled: on, send: post, storage: store } = optionsRef.current;
    if (runningRef.current || closedRef.current || !on || !id || !session) return;
    runningRef.current = true;
    try {
      while (!closedRef.current) {
        const next = Object.entries(pendingRef.current)[0];
        if (!next) {
          retryDelayRef.current = RETRY_INITIAL_MS;
          return;
        }
        const [snapshotId, flagged] = next;
        try {
          await post({ attemptId: id, sessionId: session, snapshotId, flagged });
          retryDelayRef.current = RETRY_INITIAL_MS;
          // A newer toggle made while this one was in flight is sent next.
          if (pendingRef.current[snapshotId] === flagged) {
            pendingRef.current = without(pendingRef.current, snapshotId);
            writePending(store, id, pendingRef.current);
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 409 && err.code !== 'exam_paused') {
            // Submitted, time over or the exam session moved: marks can no longer be written.
            // A paused exam is different: the mark waits and is sent after the resume.
            closedRef.current = true;
            pendingRef.current = {};
            writePending(store, id, {});
            return;
          }
          if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            pendingRef.current = without(pendingRef.current, snapshotId);
            writePending(store, id, pendingRef.current);
            continue;
          }
          // Offline, signed out (re-login resumes it), throttled or server trouble: retry later.
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            void flush();
          }, retryDelayRef.current);
          retryDelayRef.current = Math.min(RETRY_MAX_MS, retryDelayRef.current * 2);
          return;
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  // Loaded once per attempt when resume arrives; later renders never reset the marks.
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialFlags || !attemptId || initializedForRef.current === attemptId) return;
    initializedForRef.current = attemptId;
    const pending = readPending(storage, attemptId);
    const merged: Record<string, boolean> = {};
    for (const id of initialFlags) merged[id] = true;
    Object.assign(merged, pending);
    pendingRef.current = pending;
    flagsRef.current = merged;
    closedRef.current = false;
    setFlags(merged);
    void flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFlags, attemptId]);

  useEffect(() => {
    if (enabled) void flush();
  }, [enabled, sessionId, flush]);

  useEffect(() => {
    const onOnline = () => {
      retryDelayRef.current = RETRY_INITIAL_MS;
      void flush();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [flush]);

  const toggle = useCallback((snapshotId: string) => {
    if (closedRef.current) return;
    const value = !flagsRef.current[snapshotId];
    flagsRef.current = { ...flagsRef.current, [snapshotId]: value };
    setFlags(flagsRef.current);
    pendingRef.current = { ...pendingRef.current, [snapshotId]: value };
    writePending(optionsRef.current.storage, optionsRef.current.attemptId, pendingRef.current);
    void flush();
  }, [flush]);

  return { flags, toggle, flaggedCount: Object.values(flags).filter(Boolean).length };
}
