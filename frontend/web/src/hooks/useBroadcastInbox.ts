import { useCallback, useEffect, useRef, useState } from 'react';
import { postBroadcastInbox } from '../api/assessment-client.ts';
import type { BroadcastInboxResponse, InboxMessage } from '../types/assessment.ts';

// Supervisor messages on the exam screen (D04.1-77C/G, D04.5-57/58/59, D04.6-52/53). The
// device asks for them when a timer answer says the student has more than it holds, then
// confirms receiving the new ones right away, which is the delivery state supervisors see.
// A new, recent message appears once as a notice that closes by itself or by "Tutup"; all
// messages stay available to reread. Messages already shown are remembered on the device,
// so a reload does not show them again. This channel is separate from answer saving: when
// it fails, nothing else is affected and the next timer answer tries again.

const SEEN_PREFIX = 'elligble.broadcastSeen.';
/** How long a notice stays before it closes by itself. */
export const NOTICE_MS = 20_000;
/** A message older than this when it arrives goes to the list without a notice. */
const FRESH_MS = 5 * 60 * 1000;
const MAX_SEEN = 100;

export interface BroadcastInbox {
  /** Newest first. */
  messages: InboxMessage[];
  /** The message shown as a notice now, and how many other new ones came with it. */
  notice: { message: InboxMessage; more: number } | null;
  dismiss(): void;
  /** A timer answer said how many messages the student has. */
  noteCount(count: number | undefined): void;
}

function defaultStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSeen(storage: Storage | null, attemptId: string): Set<string> {
  try {
    const stored = JSON.parse(storage?.getItem(SEEN_PREFIX + attemptId) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeSeen(storage: Storage | null, attemptId: string, seen: Set<string>): void {
  try {
    storage?.setItem(SEEN_PREFIX + attemptId, JSON.stringify([...seen].slice(-MAX_SEEN)));
  } catch {
    // Storage full or blocked: at worst a notice shows again after a reload.
  }
}

/** Forgets which messages were shown for a finished attempt on this device. */
export function clearBroadcastSeen(attemptId: string, storage: Storage | null = defaultStorage()): void {
  try {
    storage?.removeItem(SEEN_PREFIX + attemptId);
  } catch {
    // Nothing to clean up.
  }
}

export function useBroadcastInbox({
  attemptId,
  enabled,
  fetchInbox = postBroadcastInbox,
  storage = defaultStorage(),
}: {
  attemptId: string;
  enabled: boolean;
  fetchInbox?: (attemptId: string, received: string[]) => Promise<BroadcastInboxResponse>;
  storage?: Storage | null;
}): BroadcastInbox {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [notice, setNotice] = useState<BroadcastInbox['notice']>(null);
  const heldRef = useRef<Set<string>>(new Set());
  const unconfirmedRef = useRef<Set<string>>(new Set());
  const totalRef = useRef(0);
  const loadingRef = useRef(false);
  const activeRef = useRef(true);
  const fetchRef = useRef(fetchInbox);
  fetchRef.current = fetchInbox;
  const storageRef = useRef(storage);
  storageRef.current = storage;

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled || !attemptId || loadingRef.current) return;
    loadingRef.current = true;
    let arrived = 0;
    try {
      const received = [...unconfirmedRef.current];
      const res = await fetchRef.current(attemptId, received);
      if (!activeRef.current) return;
      for (const id of received) unconfirmedRef.current.delete(id);
      totalRef.current = res.total;
      const fresh = res.messages.filter(m => !heldRef.current.has(m.id));
      arrived = fresh.length;
      if (arrived > 0) {
        for (const m of fresh) {
          heldRef.current.add(m.id);
          unconfirmedRef.current.add(m.id);
        }
        const seen = readSeen(storageRef.current, attemptId);
        const serverNow = Date.parse(res.serverTime);
        const toShow = fresh.filter(m => !seen.has(m.id) && !(Number.isFinite(serverNow) && serverNow - Date.parse(m.sentAt) > FRESH_MS));
        for (const m of fresh) seen.add(m.id);
        writeSeen(storageRef.current, attemptId, seen);
        if (toShow.length > 0) setNotice({ message: toShow[0], more: toShow.length - 1 });
      }
      setMessages(res.messages);
    } catch {
      // Unreachable or refused: the next timer answer tries again.
    } finally {
      loadingRef.current = false;
    }
    // Confirm at once what just arrived, so supervisors see it reached this device.
    if (arrived > 0 && activeRef.current) void refresh();
  }, [attemptId, enabled]);

  useEffect(() => {
    activeRef.current = true;
    heldRef.current = new Set();
    unconfirmedRef.current = new Set();
    totalRef.current = 0;
    setMessages([]);
    setNotice(null);
    if (enabled && attemptId) void refresh();
    return () => {
      activeRef.current = false;
    };
  }, [attemptId, enabled, refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const noteCount = useCallback((count: number | undefined) => {
    if (typeof count !== 'number') return;
    if (count > totalRef.current || unconfirmedRef.current.size > 0) void refresh();
  }, [refresh]);

  const dismiss = useCallback(() => setNotice(null), []);

  return { messages, notice, dismiss, noteCount };
}
