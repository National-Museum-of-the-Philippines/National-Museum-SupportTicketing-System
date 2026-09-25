import type { ConversationMessageRecord } from "@/lib/api/types";
import type { NotificationItem } from "@/lib/notifications";
import { messageRoleLabel } from "@/lib/messages";
import {
  ADMIN_MESSAGES,
  CLIENT_MESSAGES,
  RECORDS_MESSAGES,
} from "@/lib/navigation";
import type { PortalSlot } from "@/lib/sessions";

const MESSAGE_EVENT = "nmp-message-notification";

export type MessageNotificationPayload = {
  conversationId: string;
  message: ConversationMessageRecord;
  conversationTitle?: string;
};

type MessageListener = (slot: PortalSlot, payload: MessageNotificationPayload) => void;

function messagesPath(slot: PortalSlot) {
  if (slot === "admin") return ADMIN_MESSAGES;
  if (slot === "records") return RECORDS_MESSAGES;
  return CLIENT_MESSAGES;
}

export function addMessageNotification(slot: PortalSlot, payload: MessageNotificationPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MESSAGE_EVENT, { detail: { slot, payload } }));
}

export function subscribeMessageNotifications(listener: MessageListener) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: Event) => {
    const { slot, payload } = (e as CustomEvent<{ slot: PortalSlot; payload: MessageNotificationPayload }>).detail;
    listener(slot, payload);
  };
  window.addEventListener(MESSAGE_EVENT, handler);
  return () => window.removeEventListener(MESSAGE_EVENT, handler);
}

export function messageToNotification(
  slot: PortalSlot,
  payload: MessageNotificationPayload,
): NotificationItem {
  const preview =
    payload.message.body.length > 90
      ? `${payload.message.body.slice(0, 87)}…`
      : payload.message.body;

  const title = payload.conversationTitle
    ? `${payload.message.senderName} · ${payload.conversationTitle}`
    : payload.message.senderName;

  return {
    id: `msg-${payload.message._id}`,
    title,
    message: `${messageRoleLabel(payload.message.senderRole)} · ${preview}`,
    time: payload.message.createdAt,
    to: messagesPath(slot),
    search: { conversation: payload.conversationId },
  };
}

export function messagesToNotifications(
  slot: PortalSlot,
  payloads: MessageNotificationPayload[],
): NotificationItem[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return payloads
    .filter((p) => new Date(p.message.createdAt).getTime() >= cutoff)
    .map((p) => messageToNotification(slot, p));
}
