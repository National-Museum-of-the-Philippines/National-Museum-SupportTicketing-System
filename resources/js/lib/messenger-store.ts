import { useSyncExternalStore } from "react";
import { ADMIN_MESSAGES, CLIENT_MESSAGES, RECORDS_MESSAGES } from "@/lib/navigation";
import type { PortalSlot } from "@/lib/sessions";

/**
 * Global state for the floating chat window. Anything in the app (sidebar,
 * bell, toasts, "Request messages" buttons) opens chat through here instead of
 * navigating to a separate Messages page.
 */
export type MessengerTarget = { ticketId?: string; conversationId?: string };

type MessengerState = {
  open: boolean;
  /** Bumped on every open request so the window re-targets even if already open. */
  request: number;
  target: MessengerTarget;
};

let state: MessengerState = { open: false, request: 0, target: {} };
const listeners = new Set<() => void>();

function setState(next: MessengerState) {
  state = next;
  listeners.forEach((l) => l());
}

export function openMessenger(target: MessengerTarget = {}) {
  setState({ open: true, request: state.request + 1, target });
}

export function closeMessenger() {
  if (!state.open) return;
  setState({ ...state, open: false });
}

export function toggleMessenger() {
  if (state.open) closeMessenger();
  else openMessenger();
}

/**
 * Unread messages per conversation, counted from live events while the app is open.
 * The total drives the Messages badge in the sidebar; each chat row shows its own count.
 */
let unreadByConversation: Record<string, number> = {};
const unreadListeners = new Set<() => void>();

function setUnread(next: Record<string, number>) {
  unreadByConversation = next;
  unreadListeners.forEach((l) => l());
}

export function bumpUnreadMessages(conversationId: string) {
  setUnread({
    ...unreadByConversation,
    [conversationId]: (unreadByConversation[conversationId] ?? 0) + 1,
  });
}

export function clearConversationUnread(conversationId: string) {
  if (!unreadByConversation[conversationId]) return;
  const { [conversationId]: _read, ...rest } = unreadByConversation;
  setUnread(rest);
}

function subscribeUnread(l: () => void) {
  unreadListeners.add(l);
  return () => unreadListeners.delete(l);
}

export function useUnreadByConversation(): Record<string, number> {
  return useSyncExternalStore(
    subscribeUnread,
    () => unreadByConversation,
    () => unreadByConversation,
  );
}

/** Total unread across all chats (sidebar badge and launcher). */
export function useUnreadMessages(): number {
  const byConversation = useUnreadByConversation();
  return Object.values(byConversation).reduce((sum, n) => sum + n, 0);
}

export function useMessengerState(): MessengerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

const MESSAGE_PATHS = new Set<string>([ADMIN_MESSAGES, RECORDS_MESSAGES, CLIENT_MESSAGES]);

/** True for any portal's Messages route, so links to it can open the floating chat instead. */
export function isMessagesPath(to: string | undefined): boolean {
  return Boolean(to && MESSAGE_PATHS.has(to));
}

export function messengerTargetFromSearch(search: unknown): MessengerTarget {
  const s = (search ?? {}) as Record<string, unknown>;
  return {
    ticketId: typeof s.ticket === "string" ? s.ticket : undefined,
    conversationId: typeof s.conversation === "string" ? s.conversation : undefined,
  };
}

export type { PortalSlot };
