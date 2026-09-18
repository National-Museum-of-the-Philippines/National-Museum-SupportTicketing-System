import type { PokeRecord } from "@/lib/api/types";
import type { NotificationItem } from "@/lib/notifications";
import type { PortalSlot } from "@/lib/sessions";
import {
  ADMIN_MESSAGES,
  CLIENT_MESSAGES,
  RECORDS_MESSAGES,
} from "@/lib/navigation";
import { messageRoleLabel } from "@/lib/messages";

const POKE_EVENT = "nmp-poke-notification";

type PokeListener = (slot: PortalSlot, poke: PokeRecord) => void;

function messagesPath(slot: PortalSlot) {
  if (slot === "admin") return ADMIN_MESSAGES;
  if (slot === "records") return RECORDS_MESSAGES;
  return CLIENT_MESSAGES;
}

export function addPokeNotification(slot: PortalSlot, poke: PokeRecord) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POKE_EVENT, { detail: { slot, poke } }));
}

export function subscribePokeNotifications(listener: PokeListener) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: Event) => {
    const { slot, poke } = (e as CustomEvent<{ slot: PortalSlot; poke: PokeRecord }>).detail;
    listener(slot, poke);
  };
  window.addEventListener(POKE_EVENT, handler);
  return () => window.removeEventListener(POKE_EVENT, handler);
}

export function pokeToNotification(slot: PortalSlot, poke: PokeRecord): NotificationItem {
  return {
    id: `poke-${poke._id}`,
    title: `${poke.fromUserName} poked you`,
    message: `${messageRoleLabel(poke.fromUserRole)} · Tap to open Messages`,
    time: poke.createdAt,
    to: messagesPath(slot),
  };
}

export function pokesToNotifications(slot: PortalSlot, pokes: PokeRecord[]): NotificationItem[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return pokes
    .filter((p) => new Date(p.createdAt).getTime() >= cutoff)
    .map((p) => pokeToNotification(slot, p));
}
