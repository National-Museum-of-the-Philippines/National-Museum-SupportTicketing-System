import { useEffect, useState } from "react";
import type { NotificationItem } from "@/lib/notifications";
import type { PortalSlot } from "@/lib/sessions";

const LIVE_EVENT = "nmp-live-notification";

type LiveDetail = { slot: PortalSlot; item: NotificationItem };

export function addLiveNotification(slot: PortalSlot, item: NotificationItem) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: { slot, item } satisfies LiveDetail }));
}

export function useLiveNotifications(slot: PortalSlot): NotificationItem[] {
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { slot: eventSlot, item } = (event as CustomEvent<LiveDetail>).detail;
      if (eventSlot !== slot) return;
      setItems((prev) => {
        if (prev.some((row) => row.id === item.id)) return prev;
        return [item, ...prev].slice(0, 12);
      });
    };
    window.addEventListener(LIVE_EVENT, handler);
    return () => window.removeEventListener(LIVE_EVENT, handler);
  }, [slot]);

  return items;
}
