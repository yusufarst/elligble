import { useState, useEffect, useCallback, useRef } from 'react';
import { getTimer } from '../api/assessment-client.ts';

export interface UseAuthoritativeTimerOptions {
  attemptId: string;
  initialRemainingSeconds: number;
  enabled?: boolean;
  onExpire: () => void;
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

export function useAuthoritativeTimer({
  attemptId,
  initialRemainingSeconds,
  enabled = true,
  onExpire,
}: UseAuthoritativeTimerOptions) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialRemainingSeconds);
  const prevInitialRef = useRef<number>(initialRemainingSeconds);
  const expiredRef = useRef<boolean>(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Synchronously update state when initialRemainingSeconds updates
  if (prevInitialRef.current !== initialRemainingSeconds) {
    prevInitialRef.current = initialRemainingSeconds;
    setRemainingSeconds(initialRemainingSeconds);
    expiredRef.current = initialRemainingSeconds <= 0;
  }

  // Local 1-second monotonic countdown
  useEffect(() => {
    if (!enabled || initialRemainingSeconds <= 0) return;

    if (remainingSeconds <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpireRef.current();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds, enabled, initialRemainingSeconds]);

  // Resynchronize on focus / visibility change
  const resync = useCallback(async () => {
    if (!enabled || expiredRef.current) return;
    try {
      const timerData = await getTimer(attemptId);
      if (timerData.status === 'expired' || timerData.effectiveRemainingSeconds <= 0) {
        setRemainingSeconds(0);
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpireRef.current();
        }
      } else {
        setRemainingSeconds(timerData.effectiveRemainingSeconds);
      }
    } catch {
      // Do not crash or mutate local time on resync network failure
    }
  }, [attemptId, enabled]);

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
  };
}
