import { useMemo, useSyncExternalStore } from "react";

/**
 * Status updates the person already looked at, so a notice or badge goes away once the
 * request is opened. The key holds the status, so a later change (for example Rejected)
 * is new again. Kept per person in this browser.
 */
const KEY = "nmp.support_ticketing.seenTicketUpdates";
const MAX_PER_USER = 300;

type Store = Record<string, string[]>;

let store: Store = read();
const listeners = new Set<() => void>();

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(next: Store) {
  store = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

const EMPTY: string[] = [];

export function ticketUpdateKey(ticketId: string, status: string): string {
  return `${ticketId}:${status}`;
}

export function markTicketUpdateSeen(userId: string | undefined, ticketId: string, status: string) {
  if (!userId) return;
  const key = ticketUpdateKey(ticketId, status);
  const current = store[userId] ?? EMPTY;
  if (current.includes(key)) return;
  write({ ...store, [userId]: [...current, key].slice(-MAX_PER_USER) });
}

export function useSeenTicketUpdates(userId: string | undefined): Set<string> {
  const ids = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (userId ? (store[userId] ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
  return useMemo(() => new Set(ids), [ids]);
}
