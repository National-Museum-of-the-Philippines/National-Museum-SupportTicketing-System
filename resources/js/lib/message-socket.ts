import { io, type Socket } from "socket.io-client";
import type { ConversationMessageRecord, MentionRecord, PokeRecord } from "@/lib/api/types";
import { getTokenForSlot, type PortalSlot } from "@/lib/sessions";

export type RealtimeMessageEvent = {
  conversationId: string;
  message: ConversationMessageRecord;
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

const sockets = new Map<PortalSlot, Socket>();

function socketUrl() {
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
  if (api) return api;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function getMessageSocket(slot: PortalSlot): Socket | null {
  if (typeof window === "undefined") return null;

  const token = getTokenForSlot(slot);
  if (!token) return null;

  let socket = sockets.get(slot);
  if (socket) return socket;

  socket = io(socketUrl(), {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    timeout: 4000,
    reconnectionDelay: 1500,
    reconnectionAttempts: 8,
    autoConnect: true,
  });

  sockets.set(slot, socket);
  return socket;
}

export function disconnectMessageSocket(slot: PortalSlot) {
  const socket = sockets.get(slot);
  if (!socket) return;
  socket.disconnect();
  sockets.delete(slot);
}

export function joinConversationRoom(slot: PortalSlot, conversationId: string) {
  const socket = getMessageSocket(slot);
  socket?.emit("join:conversation", conversationId);
}

export function onRealtimeMessage(slot: PortalSlot, handler: (event: RealtimeMessageEvent) => void) {
  const socket = getMessageSocket(slot);
  if (!socket) return () => undefined;
  socket.on("message:new", handler);
  return () => socket.off("message:new", handler);
}

export function onRealtimeConversationUpdate(
  slot: PortalSlot,
  handler: (event: RealtimeConversationEvent) => void,
) {
  const socket = getMessageSocket(slot);
  if (!socket) return () => undefined;
  socket.on("conversation:update", handler);
  return () => socket.off("conversation:update", handler);
}

export function onRealtimePoke(slot: PortalSlot, handler: (poke: PokeRecord) => void) {
  const socket = getMessageSocket(slot);
  if (!socket) return () => undefined;
  socket.on("poke", handler);
  return () => socket.off("poke", handler);
}

export function onRealtimeMention(slot: PortalSlot, handler: (mention: MentionRecord) => void) {
  const socket = getMessageSocket(slot);
  if (!socket) return () => undefined;
  socket.on("mention", handler);
  return () => socket.off("mention", handler);
}

export function onRealtimeNotification(
  slot: PortalSlot,
  handler: (event: RealtimeNotificationEvent) => void,
) {
  const socket = getMessageSocket(slot);
  if (!socket) return () => undefined;
  socket.on("notification", handler);
  return () => socket.off("notification", handler);
}
