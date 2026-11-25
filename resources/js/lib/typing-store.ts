import { useSyncExternalStore } from "react";

/**
 * Who is typing in which chat, from live events. An entry expires a few seconds after the
 * last signal, so a person who stops typing disappears without any extra message.
 */
const TYPING_TTL_MS = 4500;

type Typer = { name: string; timer: ReturnType<typeof setTimeout> };

let typers: Record<string, Record<string, Typer>> = {};
let snapshot: Record<string, string[]> = {};
const listeners = new Set<() => void>();

function publish() {
  const next: Record<string, string[]> = {};
  for (const [conversationId, people] of Object.entries(typers)) {
    const names = Object.values(people).map((p) => p.name);
    if (names.length > 0) next[conversationId] = names;
  }
  snapshot = next;
  listeners.forEach((l) => l());
}

export function setTyping(conversationId: string, userId: string, name: string) {
  const people = (typers[conversationId] ??= {});
  if (people[userId]) clearTimeout(people[userId].timer);
  people[userId] = {
    name,
    timer: setTimeout(() => clearTyping(conversationId, userId), TYPING_TTL_MS),
  };
  publish();
}

export function clearTyping(conversationId: string, userId: string) {
  const person = typers[conversationId]?.[userId];
  if (!person) return;
  clearTimeout(person.timer);
  delete typers[conversationId][userId];
  publish();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Names of the people typing, per conversation id. */
export function useTypingByConversation(): Record<string, string[]> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

/** "Ana is typing…", "Ana and Ben are typing…", or "Ana, Ben and 2 others are typing…". */
export function typingLabel(names: string[]): string {
  const first = (n: string) => n.split(" ")[0];
  if (names.length === 1) return `${first(names[0])} is typing…`;
  if (names.length === 2) return `${first(names[0])} and ${first(names[1])} are typing…`;
  return `${first(names[0])}, ${first(names[1])} and ${names.length - 2} other${names.length - 2 === 1 ? "" : "s"} are typing…`;
}
