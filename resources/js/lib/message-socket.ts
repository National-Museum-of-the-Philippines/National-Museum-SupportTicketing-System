import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { apiBase } from "@/lib/api-base";
import type { ConversationMessageRecord, MentionRecord, PokeRecord } from "@/lib/api/types";
import { getSession, getTokenForSlot, type PortalSlot } from "@/lib/sessions";

export type RealtimeMessageEvent = {
  conversationId: string;
  message: ConversationMessageRecord;
};

export type RealtimeConversationEvent = {
  conversationId: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderName: string;
};

export type RealtimeNotificationEvent = {
  actorId?: string;
  audience?: "admin" | "client" | "records" | string;
  type?: string;
  title: string;
  message: string;
  to?: string;
  params?: Record<string, string>;
  ticketId?: string;
  formId?: string;
  createdAt?: string;
};

type EchoConnection = Echo<"reverb">;

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

const connections = new Map<PortalSlot, EchoConnection>();

function reverbHost() {
  return (import.meta.env.VITE_REVERB_HOST || "localhost").replaceAll('"', "");
}

function reverbPort() {
  const raw = String(import.meta.env.VITE_REVERB_PORT || "8080").replaceAll('"', "");
  const port = Number(raw);
  return Number.isFinite(port) ? port : 8080;
}

function channelNames(slot: PortalSlot): string[] {
  const user = getSession(slot)?.user;
  if (!user) return [];
  const names = [`user.${user.id}`, `role.${user.role}`, "inbox"];
  if (user.role === "super_admin") {
    names.push("role.admin", "role.record_management");
  }
  return names;
}

export function getMessageSocket(slot: PortalSlot): EchoConnection | null {
  if (typeof window === "undefined") return null;

  const token = getTokenForSlot(slot);
  if (!token) return null;

  const existing = connections.get(slot);
  if (existing) return existing;

  window.Pusher = Pusher;
  const echo = new Echo({
    broadcaster: "reverb",
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: reverbHost(),
    wsPort: reverbPort(),
    wssPort: reverbPort(),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME || "http").replaceAll('"', "") === "https",
    wsPath: "/support",
    enabledTransports: ["ws", "wss"],
    authEndpoint: `${apiBase()}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  });

  connections.set(slot, echo);
  return echo;
}

export function disconnectMessageSocket(slot: PortalSlot) {
  const echo = connections.get(slot);
  if (!echo) return;
  echo.disconnect();
  connections.delete(slot);
}

export function joinConversationRoom(slot: PortalSlot, _conversationId: string) {
  getMessageSocket(slot);
}

function listen<T>(slot: PortalSlot, event: string, handler: (payload: T) => void) {
  const echo = getMessageSocket(slot);
  if (!echo) return () => undefined;

  const names = channelNames(slot);
  for (const name of names) {
    echo.private(name).listen(`.${event}`, handler);
  }

  return () => {
    for (const name of names) {
      echo.private(name).stopListening(`.${event}`, handler);
    }
  };
}

export function onRealtimeMessage(slot: PortalSlot, handler: (event: RealtimeMessageEvent) => void) {
  return listen(slot, "message.new", handler);
}

export function onRealtimeConversationUpdate(
  slot: PortalSlot,
  handler: (event: RealtimeConversationEvent) => void,
) {
  return listen(slot, "conversation.update", handler);
}

export function onRealtimePoke(slot: PortalSlot, handler: (poke: PokeRecord) => void) {
  return listen(slot, "poke", handler);
}

export function onRealtimeMention(slot: PortalSlot, handler: (mention: MentionRecord) => void) {
  return listen(slot, "mention", handler);
}

export function onRealtimeNotification(
  slot: PortalSlot,
  handler: (event: RealtimeNotificationEvent) => void,
) {
  return listen(slot, "notification", handler);
}
