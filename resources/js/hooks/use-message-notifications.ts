import { useEffect, useMemo, useState } from "react";
import type { NotificationItem } from "@/lib/notifications";
import {
  messagesToNotifications,
  subscribeMessageNotifications,
  type MessageNotificationPayload,
} from "@/lib/message-notifications";
import type { PortalSlot } from "@/lib/sessions";

export function useMessageNotifications(slot: PortalSlot, enabled = true): NotificationItem[] {
  const [liveMessages, setLiveMessages] = useState<MessageNotificationPayload[]>([]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeMessageNotifications((eventSlot, payload) => {
      if (eventSlot !== slot) return;
      setLiveMessages((prev) => {
        if (prev.some((item) => item.message._id === payload.message._id)) return prev;
        return [payload, ...prev].slice(0, 12);
      });
    });
  }, [slot, enabled]);

  return useMemo(() => messagesToNotifications(slot, liveMessages), [liveMessages, slot]);
}
