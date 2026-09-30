import { useState, useEffect, useCallback, useRef } from 'react';
import { getTimer } from '../api/assessment-client.ts';
import type { TimerResponse } from '../types/assessment.ts';

export interface UseAuthoritativeTimerOptions {
  attemptId: string;
  initialRemainingSeconds: number;
  enabled?: boolean;
  onExpire: () => void;
  /** Receives every timer response, so the caller also learns the exam state (pause, end). */
  onTimerInfo?: (timer: TimerResponse) => void;
}

export function formatRemainingTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TICK_MS = 250;

function monotonicNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// The server owns the clock; the device only counts down towards a deadline derived from
// the server's remaining seconds. A monotonic deadline keeps the display correct when the
// tab is throttled in the background or the device clock is changed, and every resync
// (focus, visibility) replaces the deadline with the server's value.
export function useAuthoritativeTimer({
  attemptId,
  initialRemainingSeconds,
  enabled = true,
  onExpire,
  onTimerInfo,
}: UseAuthoritativeTimerOptions) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialRemainingSeconds);
  const deadlineRef = useRef<number>(monotonicNow() + initialRemainingSeconds * 1000);
  const prevInitialRef = useRef<number>(initialRemainingSeconds);
  const expiredRef = useRef<boolean>(initialRemainingSeconds <= 0);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const onTimerInfoRef = useRef(onTimerInfo);
  onTimerInfoRef.current = onTimerInfo;

  if (prevInitialRef.current !== initialRemainingSeconds) {
    prevInitialRef.current = initialRemainingSeconds;
    deadlineRef.current = monotonicNow() + initialRemainingSeconds * 1000;
    expiredRef.current = initialRemainingSeconds <= 0;
    setRemainingSeconds(initialRemainingSeconds);
  }

  const applyServerRemaining = useCallback((seconds: number) => {
    const clamped = Math.max(0, seconds);
    deadlineRef.current = monotonicNow() + clamped * 1000;
    setRemainingSeconds(clamped);
    if (clamped > 0) {
      expiredRef.current = false;
    } else if (!expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (expiredRef.current) return;
      const left = Math.max(0, Math.ceil((deadlineRef.current - monotonicNow()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  // Resynchronize with the server on focus / visibility change.
  const resync = useCallback(async () => {
    if (!enabled || expiredRef.current) return;
    try {
      const timerData = await getTimer(attemptId);
      if (onTimerInfoRef.current) onTimerInfoRef.current(timerData);
      else applyServerRemaining(timerData.status === 'expired' ? 0 : timerData.effectiveRemainingSeconds);
    } catch {
      // Do not crash or mutate local time on resync network failure
    }
  }, [attemptId, enabled, applyServerRemaining]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resync();
      }
    };

    const handleFocus = () => {
      resync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [resync, enabled]);

  const isWarning = remainingSeconds > 0 && remainingSeconds < 300;
  const isUrgent = remainingSeconds > 0 && remainingSeconds < 60;
  const isExpired = remainingSeconds <= 0;

  return {
    remainingSeconds,
    formattedTime: formatRemainingTime(remainingSeconds),
    isWarning,
    isUrgent,
    isExpired,
    resync,
    /** Replace the countdown with the server's remaining seconds (e.g. after timer_not_expired). */
    applyServerRemaining,
  };
}
