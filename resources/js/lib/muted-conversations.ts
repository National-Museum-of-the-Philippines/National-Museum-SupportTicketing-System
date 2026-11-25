import { useMemo, useSyncExternalStore } from "react";

/**
 * Chats a person muted: no sound, pop-up or bell notice for new messages, and they do not
 * count in the unread badge. Kept per person in this browser.
 */
const KEY = "nmp.support_ticketing.mutedConversations";

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

export function isConversationMuted(userId: string | undefined, conversationId: string): boolean {
    return Boolean(userId && store[userId]?.includes(conversationId));
}

/** Returns true when the chat is muted after the change. */
export function toggleConversationMuted(userId: string, conversationId: string): boolean {
    const current = store[userId] ?? EMPTY;
    const muted = !current.includes(conversationId);
    write({
        ...store,
        [userId]: muted
            ? [...current, conversationId]
            : current.filter((id) => id !== conversationId),
    });
    return muted;
}

export function useMutedConversations(userId: string | undefined): Set<string> {
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
