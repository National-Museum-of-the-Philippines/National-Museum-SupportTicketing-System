import type { PortalSlot } from "@/lib/sessions";

const activeBySlot = new Map<PortalSlot, string | null>();

export function setActiveConversationId(slot: PortalSlot, conversationId: string | null) {
  activeBySlot.set(slot, conversationId);
}

export function getActiveConversationId(slot: PortalSlot) {
  return activeBySlot.get(slot) ?? null;
}

export function isViewingConversation(slot: PortalSlot, conversationId: string) {
  return document.hasFocus() && getActiveConversationId(slot) === conversationId;
}
