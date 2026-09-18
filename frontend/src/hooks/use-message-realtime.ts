import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import type { ConversationMessageRecord, ConversationRecord, MentionRecord, PokeRecord } from "@/lib/api/types";
import { messageRoleLabel } from "@/lib/messages";
import {
  getMessageSocket,
  onRealtimeConversationUpdate,
  onRealtimeMessage,
  onRealtimeMention,
  onRealtimeNotification,
  onRealtimePoke,
  type RealtimeConversationEvent,
  type RealtimeMessageEvent,
  type RealtimeNotificationEvent,
} from "@/lib/message-socket";
import { isViewingConversation } from "@/lib/active-conversation";
import { addMessageNotification } from "@/lib/message-notifications";
import { addLiveNotification } from "@/lib/live-notifications";
import { playMessageSound } from "@/lib/notification-sound";
import { addPokeNotification } from "@/lib/poke-notifications";
import {
  ADMIN_FORMS,
  ADMIN_MESSAGES,
  ADMIN_MY_REQUESTS_SUBMIT,
  CLIENT_MESSAGES,
  CLIENT_SUBMIT,
  RECORDS_MESSAGES,
  isAdminRole,
  isClientRole,
  isRecordsRole,
} from "@/lib/navigation";
import type { PortalSlot } from "@/lib/sessions";
import { useAuth } from "@/lib/auth";

function isFormFillPath(pathname: string) {
  return (
    pathname === ADMIN_FORMS ||
    pathname.startsWith(`${ADMIN_FORMS}/`) ||
    pathname === ADMIN_MY_REQUESTS_SUBMIT ||
    pathname.startsWith(`${ADMIN_MY_REQUESTS_SUBMIT}/`) ||
    pathname === CLIENT_SUBMIT ||
    pathname.startsWith(`${CLIENT_SUBMIT}/`)
  );
}

function matchesSlot(slot: PortalSlot, audience?: string) {
  if (!audience) return true;
  return audience === slot;
}

function messagesPathForSlot(slot: PortalSlot) {
  if (slot === "admin") return ADMIN_MESSAGES;
  if (slot === "records") return RECORDS_MESSAGES;
  return CLIENT_MESSAGES;
}

function appendMessage(
  items: ConversationMessageRecord[] | undefined,
  message: ConversationMessageRecord,
) {
  if (!items) return [message];
  if (items.some((m) => m._id === message._id)) return items;
  return [...items, message];
}

function patchConversations(
  items: ConversationRecord[] | undefined,
  update: RealtimeConversationEvent,
) {
  if (!items) return items;
  return items
    .map((conv) =>
      conv._id === update.conversationId
        ? {
            ...conv,
            lastMessageAt: update.lastMessageAt,
            lastMessagePreview: update.lastMessagePreview,
            lastSenderName: update.lastSenderName,
          }
        : conv,
    )
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
}

export function useMessageRealtime(slot: PortalSlot) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fillingForm = useRouterState({ select: (s) => isFormFillPath(s.location.pathname) });

  useEffect(() => {
    if (!user || fillingForm) return;
    const roleOk =
      (slot === "admin" && isAdminRole(user.role)) ||
      (slot === "records" && isRecordsRole(user.role)) ||
      (slot === "client" && isClientRole(user.role));
    if (!roleOk) return;

    getMessageSocket(slot);

    const unsubMessage = onRealtimeMessage(slot, (event: RealtimeMessageEvent) => {
      qc.setQueryData(
        ["conversation-messages", event.conversationId, slot],
        (old: { items: ConversationMessageRecord[] } | undefined) => ({
          items: appendMessage(old?.items, event.message),
        }),
      );
      qc.setQueryData(
        ["conversations", slot],
        (old: { items: ConversationRecord[] } | undefined) => {
          if (!old) return old;
          return {
            items:
              patchConversations(old.items, {
                conversationId: event.conversationId,
                lastMessageAt: event.message.createdAt,
                lastMessagePreview: event.message.body,
                lastSenderName: event.message.senderName,
              }) ?? old.items,
          };
        },
      );

      if (
        event.message.senderId === user.id ||
        event.message.isSystem ||
        isViewingConversation(slot, event.conversationId)
      ) {
        return;
      }

      const conversationTitle = qc
        .getQueryData<{ items: ConversationRecord[] }>(["conversations", slot])
        ?.items?.find((conv) => conv._id === event.conversationId)?.title;

      const isMentioned = event.message.mentions?.some((mention) => mention.userId === user.id);

      playMessageSound();
      addMessageNotification(slot, {
        conversationId: event.conversationId,
        message: event.message,
        conversationTitle,
      });

      if (!isMentioned) {
        const preview =
          event.message.body.length > 100
            ? `${event.message.body.slice(0, 97)}…`
            : event.message.body;
        toast(event.message.senderName, {
          description: preview,
          action: {
            label: "Open chat",
            onClick: () =>
              navigate({
                to: messagesPathForSlot(slot),
                search: { conversation: event.conversationId },
              }),
          },
        });
      }
    });

    const unsubConv = onRealtimeConversationUpdate(slot, (update) => {
      qc.setQueryData(
        ["conversations", slot],
        (old: { items: ConversationRecord[] } | undefined) =>
          old ? { items: patchConversations(old.items, update) ?? old.items } : old,
      );
    });

    const unsubPoke = onRealtimePoke(slot, (poke: PokeRecord) => {
      addPokeNotification(slot, poke);
      toast(`${poke.fromUserName} poked you!`, {
        description: `${messageRoleLabel(poke.fromUserRole)} is waiting for your attention.`,
        action: poke.conversationId
          ? {
              label: "Open chat",
              onClick: () => navigate({ to: messagesPathForSlot(slot) }),
            }
          : undefined,
      });
    });

    const unsubMention = onRealtimeMention(slot, (mention: MentionRecord) => {
      if (isViewingConversation(slot, mention.conversationId)) return;
      toast(`${mention.fromUserName} mentioned you`, {
        description: mention.preview,
        action: {
          label: "Open chat",
          onClick: () =>
            navigate({
              to: messagesPathForSlot(slot),
              search: { conversation: mention.conversationId },
            }),
        },
      });
    });

    const unsubNotification = onRealtimeNotification(slot, (event: RealtimeNotificationEvent) => {
      if (!matchesSlot(slot, event.audience)) return;
      if (event.actorId && event.actorId === user.id) return;

      const to =
        event.to ??
        (slot === "admin" ? "/admin/approvals" : slot === "records" ? "/records/pending" : "/client/requests");

      addLiveNotification(slot, {
        id: `${event.type ?? "n"}-${event.ticketId ?? event.formId ?? event.createdAt ?? Date.now()}`,
        title: event.title,
        message: event.message,
        time: event.createdAt,
        to,
        params: event.params,
      });

      if (event.type === "ticket.assigned") {
        void qc.invalidateQueries({ queryKey: ["assigned-tickets"] });
      }

      playMessageSound();
      toast(event.title, {
        description: event.message,
        action:
          event.type === "ticket.assigned"
            ? {
                label: "Open",
                onClick: () => {
                  if (event.ticketId) {
                    void navigate({
                      to: slot === "admin" ? "/admin/requests/$ticketId" : "/client/requests/$ticketId",
                      params: { ticketId: event.ticketId },
                    });
                    return;
                  }
                  void navigate({ to });
                },
              }
            : undefined,
      });
    });

    return () => {
      unsubMessage();
      unsubConv();
      unsubPoke();
      unsubMention();
      unsubNotification();
    };
  }, [user, slot, qc, navigate, fillingForm]);
}
