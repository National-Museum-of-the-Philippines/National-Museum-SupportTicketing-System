import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  Hand,
  Loader2,
  MessageCircle,
  Search,
  SquarePen,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/layout/workspace-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MessageBody } from "@/components/messages/MessageBody";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { api } from "@/lib/api/client";
import type {
  ConversationMessageRecord,
  ConversationRecord,
  MessageableUser,
  TicketRecord,
} from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { setActiveConversationId } from "@/lib/active-conversation";
import { joinConversationRoom } from "@/lib/message-socket";
import { subscribeMessageNotifications } from "@/lib/message-notifications";
import { groupUsersByRole, messageRoleLabel } from "@/lib/messages";
import {
  bumpUnreadMessages,
  clearConversationUnread,
  closeMessenger,
  openMessenger,
  useMessengerState,
  useUnreadByConversation,
  useUnreadMessages,
  type MessengerTarget,
} from "@/lib/messenger-store";
import type { PortalSlot } from "@/lib/sessions";
import { cn, formatAssignedPersonnel } from "@/lib/utils";

const SCROLL_BOTTOM_THRESHOLD = 72;
/** Messages from the same sender within this window are visually grouped. */
const GROUP_GAP_MS = 5 * 60 * 1000;

/** Per portal: the chat that was open when the window was closed, so reopening resumes it. */
const lastSelectedBySlot = new Map<PortalSlot, string>();

type ChatRole = "admin" | "staff" | "client" | "records";

type Participant = { id: string; name: string; role: ChatRole };

/** In a request chat the ticket's creator is the "Client"; everyone else by account role. */
function chatRole(role: string, userId: string, creatorId: string | null): ChatRole {
  if (creatorId && userId === creatorId) return "client";
  if (role === "admin" || role === "super_admin") return "admin";
  if (role === "record_management") return "records";
  return "staff";
}

function chatRoleLabel(role: ChatRole, rawRole: string) {
  if (role === "client") return "Client";
  if (role === "staff") return "Staff";
  return messageRoleLabel(rawRole);
}

function creatorIdOf(ticket: TicketRecord | undefined): string | null {
  if (!ticket?.creatorId) return null;
  return typeof ticket.creatorId === "string" ? ticket.creatorId : ticket.creatorId._id;
}

/**
 * Floating chat: a launcher button in the bottom-right corner of every portal
 * page that opens the chat as a modal over the current page.
 */
export function FloatingMessenger({ slot }: { slot: PortalSlot }) {
  const { user } = useAuth();
  const { open, request, target } = useMessengerState();
  const unread = useUnreadMessages();

  // Count messages that arrive while the window is closed.
  useEffect(
    () =>
      subscribeMessageNotifications((eventSlot, payload) => {
        if (eventSlot === slot) bumpUnreadMessages(payload.conversationId);
      }),
    [slot],
  );

  if (!user) return null;

  return open ? (
    <MessengerWindow key={slot} slot={slot} request={request} target={target} />
  ) : (
    <button
      type="button"
      onClick={() => openMessenger()}
      className="messenger-launcher"
      aria-label={unread > 0 ? `Open messages, ${unread} unread` : "Open messages"}
    >
      <MessageCircle className="h-6 w-6" />
      {unread > 0 ? (
        <span className="messenger-launcher-badge">{unread > 9 ? "9+" : unread}</span>
      ) : null}
    </button>
  );
}

function MessengerWindow({
  slot,
  request,
  target,
}: {
  slot: PortalSlot;
  request: number;
  target: MessengerTarget;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      target.conversationId ?? (target.ticketId ? null : (lastSelectedBySlot.get(slot) ?? null)),
  );
  const [view, setView] = useState<"list" | "thread">(() =>
    target.conversationId || target.ticketId || lastSelectedBySlot.has(slot) ? "thread" : "list",
  );
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [pokedFlash, setPokedFlash] = useState(false);
  const [newBelowCount, setNewBelowCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevLastMessageIdRef = useRef<string | null>(null);

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      setView("thread");
    },
    [],
  );

  // Remember the chat only if the window is closed while a chat is open, so the next
  // open resumes it. Closing from the chat list (or after going back) opens the list.
  const resumeRef = useRef<string | null>(null);
  resumeRef.current = view === "thread" ? selectedId : null;
  useEffect(
    () => () => {
      if (resumeRef.current) lastSelectedBySlot.set(slot, resumeRef.current);
      else lastSelectedBySlot.delete(slot);
    },
    [slot],
  );

  // Re-target when something asks to open a specific chat while already open.
  useEffect(() => {
    if (target.conversationId && !target.ticketId) selectConversation(target.conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (!target.ticketId) return;
    let cancelled = false;
    void api
      .getTicketConversation(target.ticketId, slot)
      .then((data) => {
        if (cancelled) return;
        selectConversation(data.conversation._id);
        void qc.invalidateQueries({ queryKey: ["conversations", slot] });
      })
      .catch((err: Error) => toast.error(err.message || "Could not open the request chat"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, target.ticketId, slot]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isAtBottomRef.current = true;
    setNewBelowCount(0);
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD;
    isAtBottomRef.current = atBottom;
    if (atBottom) setNewBelowCount(0);
  }, []);

  const activeId = view === "thread" ? selectedId : null;
  const unreadByConversation = useUnreadByConversation();

  // Opening a chat marks it as read.
  useEffect(() => {
    if (activeId) clearConversationUnread(activeId);
  }, [activeId]);

  useEffect(() => {
    if (activeId) joinConversationRoom(slot, activeId);
  }, [slot, activeId]);

  useEffect(() => {
    setActiveConversationId(slot, activeId);
    return () => setActiveConversationId(slot, null);
  }, [slot, activeId]);

  useEffect(() => {
    isAtBottomRef.current = true;
    setNewBelowCount(0);
    prevMessageCountRef.current = 0;
    prevLastMessageIdRef.current = null;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [activeId, scrollToBottom]);

  // Escape closes the window (the New message dialog handles its own Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !newChatOpen && !e.defaultPrevented) closeMessenger();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChatOpen]);

  const { data: convData, isLoading: convLoading } = useQuery({
    queryKey: ["conversations", slot],
    queryFn: () => api.listConversations(slot),
  });
  const conversations = convData?.items ?? [];

  const selected = useMemo(
    () => conversations.find((c) => c._id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const ticketId = view === "thread" ? (selected?.ticketId ?? null) : null;
  const { data: ticketData } = useQuery({
    queryKey: ["ticket", ticketId, slot],
    queryFn: () => api.getTicket(ticketId!, slot),
    enabled: Boolean(ticketId),
  });
  const ticket = ticketId ? ticketData?.ticket : undefined;
  const creatorId = creatorIdOf(ticket);

  const { data: peopleData } = useQuery({
    queryKey: ["mentionable-users", activeId, slot],
    queryFn: () => api.listMentionableUsers(activeId!, slot),
    enabled: Boolean(activeId) && !selected?.isGlobal,
  });

  const participants = useMemo<Participant[]>(() => {
    if (!user || !selected || selected.isGlobal) return [];
    const rows: Participant[] = (peopleData?.users ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      role: chatRole(u.role, u.id, creatorId),
    }));
    if (!rows.some((p) => p.id === user.id)) {
      rows.push({
        id: user.id,
        name: user.name ?? "You",
        role: chatRole(user.role, user.id, creatorId),
      });
    }
    const order: Record<ChatRole, number> = { admin: 0, records: 1, staff: 2, client: 3 };
    return rows.sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  }, [peopleData?.users, user, selected, creatorId]);

  const groupedConversations = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    const match = (c: ConversationRecord) =>
      !q ||
      c.title.toLowerCase().includes(q) ||
      (c.subtitle ?? "").toLowerCase().includes(q) ||
      c.lastMessagePreview.toLowerCase().includes(q);
    const byRecent = (a: ConversationRecord, b: ConversationRecord) =>
      (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
    const rows = conversations.filter(match);
    return [
      { label: "Team", items: rows.filter((c) => c.isGlobal) },
      { label: "Requests", items: rows.filter((c) => c.type === "ticket").sort(byRecent) },
      {
        label: "Direct messages",
        items: rows.filter((c) => !c.isGlobal && c.type !== "ticket").sort(byRecent),
      },
    ].filter((g) => g.items.length > 0);
  }, [conversations, listSearch]);

  const { data: msgData, isLoading: msgLoading } = useQuery({
    queryKey: ["conversation-messages", activeId, slot],
    queryFn: () => api.listConversationMessages(activeId!, slot),
    enabled: Boolean(activeId),
  });
  const messages = msgData?.items ?? [];

  const send = useMutation({
    mutationFn: () => api.postConversationMessage(activeId!, draft.trim(), slot, mentionIds),
    onSuccess: (data) => {
      setDraft("");
      setMentionIds([]);
      if (activeId && data.message) {
        const message = data.message as ConversationMessageRecord;
        qc.setQueryData(
          ["conversation-messages", activeId, slot],
          (old: { items: ConversationMessageRecord[] } | undefined) => {
            const items = old?.items ?? [];
            if (items.some((m) => m._id === message._id)) return { items };
            return { items: [...items, message] };
          },
        );
        qc.setQueryData(
          ["conversations", slot],
          (old: { items: ConversationRecord[] } | undefined) =>
            old
              ? {
                  items: old.items.map((conv) =>
                    conv._id === activeId
                      ? {
                          ...conv,
                          lastMessageAt: message.createdAt,
                          lastMessagePreview: message.body,
                          lastSenderName: message.senderName,
                        }
                      : conv,
                  ),
                }
              : old,
        );
      }
      requestAnimationFrame(() => scrollToBottom("smooth"));
    },
    onError: (err: Error) => toast.error(err.message || "Could not send message"),
  });

  const startChat = useMutation({
    mutationFn: (userId: string) => api.startDirectConversation(userId, slot),
    onSuccess: (data) => {
      setNewChatOpen(false);
      setUserSearch("");
      void qc.invalidateQueries({ queryKey: ["conversations", slot] });
      selectConversation(data.conversation._id);
    },
    onError: (err: Error) => toast.error(err.message || "Could not start chat"),
  });

  const poke = useMutation({
    mutationFn: (userId: string) => api.pokeUser(userId, slot),
    onSuccess: (_data, userId) => {
      const name = selected?.otherUser?.id === userId ? selected.otherUser.name : "them";
      toast.success(`Poked ${name}!`);
    },
    onError: (err: Error) => toast.error(err.message || "Could not send poke"),
  });

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isAtBottomRef.current = entry.isIntersecting;
        if (entry.isIntersecting) setNewBelowCount(0);
      },
      { root, threshold: 0, rootMargin: "1px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeId, messages.length, msgLoading]);

  useEffect(() => {
    const count = messages.length;
    const lastId = messages[count - 1]?._id ?? null;
    if (msgLoading) return;
    if (count === 0) {
      prevMessageCountRef.current = 0;
      prevLastMessageIdRef.current = null;
      return;
    }
    const isFirstBatch = prevMessageCountRef.current === 0 || prevLastMessageIdRef.current === null;
    const hasNewTail = lastId !== prevLastMessageIdRef.current;
    const added = hasNewTail ? Math.max(count - prevMessageCountRef.current, 1) : 0;
    prevMessageCountRef.current = count;
    prevLastMessageIdRef.current = lastId;

    if (isFirstBatch) {
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }
    if (!hasNewTail || added === 0) return;
    const isOwnMessage = messages[count - 1]?.senderId === user?.id;
    if (isAtBottomRef.current || isOwnMessage) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } else {
      setNewBelowCount((n) => n + added);
    }
  }, [messages, msgLoading, user?.id, scrollToBottom]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ slot: PortalSlot }>).detail?.slot !== slot) return;
      setPokedFlash(true);
      window.setTimeout(() => setPokedFlash(false), 1200);
    };
    window.addEventListener("nmp-poke-notification", handler);
    return () => window.removeEventListener("nmp-poke-notification", handler);
  }, [slot]);

  const handleSubmit = () => {
    if (!draft.trim() || !activeId || send.isPending) return;
    send.mutate();
  };

  if (!user) return null;

  const ticketPath =
    slot === "admin"
      ? "/admin/requests/$ticketId"
      : slot === "client"
        ? "/client/requests/$ticketId"
        : null;

  const closeButton = (className?: string) => (
    <button
      type="button"
      className={cn("messenger-icon-btn", className)}
      onClick={closeMessenger}
      title="Close"
      aria-label="Close messages"
    >
      <X className="h-4 w-4" />
    </button>
  );

  const listView = (
    <div className="messenger-pane-list">
      <header className="messenger-list-header">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-maroon" />
          <h2 className="text-base font-semibold">Messages</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setNewChatOpen(true)}
            className="h-8 gap-1.5 px-2.5"
          >
            <SquarePen className="h-3.5 w-3.5" />
            New
          </Button>
          {closeButton()}
        </div>
      </header>
      <div className="px-4 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search chats"
            className="pl-9"
            aria-label="Search chats"
          />
        </div>
      </div>
      <div className="messenger-conversation-list">
        {convLoading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading chats…
          </div>
        ) : groupedConversations.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {listSearch ? "No chats match your search." : "No chats yet. Start one with New."}
          </p>
        ) : (
          groupedConversations.map((group) => (
            <div key={group.label}>
              <p className="messenger-list-label">{group.label}</p>
              {group.items.map((conv) => (
                <ConversationRow
                  key={conv._id}
                  conversation={conv}
                  active={conv._id === selectedId}
                  unread={unreadByConversation[conv._id] ?? 0}
                  onClick={() => selectConversation(conv._id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const threadView = selected ? (
    <>
      <section className="messenger-pane-thread">
        <header className="messenger-thread-head">
          <button
            type="button"
            onClick={() => setView("list")}
            className="messenger-icon-btn -ml-1.5"
            aria-label="Back to chats"
            title="All chats"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <ConversationTile conversation={selected} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold leading-tight tracking-tight">
              {selected.title}
            </h2>
            {selected.type === "ticket" ? (
              <div className="mt-1 flex min-w-0 items-center gap-2">
                {(ticket?.status ?? selected.ticketStatus) ? (
                  <StatusBadge status={ticket?.status ?? selected.ticketStatus ?? ""} />
                ) : null}
                <p className="truncate text-xs text-muted-foreground">
                  {ticket?.formTitle ?? selected.ticketTitle ?? selected.subtitle}
                </p>
              </div>
            ) : (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selected.isGlobal
                  ? selected.subtitle || "Team chat"
                  : selected.otherUser
                    ? `${messageRoleLabel(selected.otherUser.role)} · ${selected.otherUser.division}`
                    : selected.subtitle}
              </p>
            )}
          </div>
          {participants.length > 1 ? <AvatarStack people={participants} /> : null}
          {selected.otherUser ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="messenger-outline-btn shrink-0 gap-1.5"
              disabled={poke.isPending}
              onClick={() => poke.mutate(selected.otherUser!.id)}
            >
              {poke.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Hand className="h-3.5 w-3.5" />
              )}
              Poke
            </Button>
          ) : null}
          {selected.ticketId && ticketPath ? (
            <Button asChild size="sm" variant="outline" className="messenger-outline-btn shrink-0">
              <Link
                to={ticketPath}
                params={{ ticketId: selected.ticketId }}
                onClick={closeMessenger}
              >
                View ticket
              </Link>
            </Button>
          ) : null}
          {closeButton("messenger-close-narrow")}
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleMessagesScroll}
            className="messenger-messages-scroll messenger-thread-bg h-full overflow-y-auto px-4 py-4 sm:px-6"
          >
            {msgLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <ConversationTile conversation={selected} />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  {selected.isGlobal
                    ? "Say hello to the team. Messages appear instantly for everyone."
                    : "Send the first message below."}
                </p>
              </div>
            ) : (
              <MessageList messages={messages} currentUserId={user.id} creatorId={creatorId} />
            )}
            <div ref={bottomSentinelRef} className="h-px w-full shrink-0" aria-hidden />
          </div>

          {newBelowCount > 0 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="messenger-jump-to-bottom pointer-events-auto"
              >
                <ChevronDown className="h-4 w-4" />
                {newBelowCount} new message{newBelowCount === 1 ? "" : "s"}
              </button>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="messenger-composer"
        >
          <MessageComposer
            slot={slot}
            conversationId={activeId}
            value={draft}
            onChange={setDraft}
            mentionIds={mentionIds}
            onMentionIdsChange={setMentionIds}
            onSubmit={handleSubmit}
            disabled={send.isPending}
            boxed
            autoFocus
            sending={send.isPending}
            placeholder={
              selected.isGlobal
                ? "Message the NMP team…"
                : selected.type === "ticket"
                  ? "Message about this request…"
                  : `Message ${selected.title}…`
            }
          />
        </form>
      </section>

      <DetailsPanel
        conversation={selected}
        ticket={ticket}
        participants={participants}
        closeButton={closeButton()}
      />
    </>
  ) : (
    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Opening chat…
    </div>
  );

  const showThread = view === "thread" && (selected || convLoading || target.ticketId);

  return (
    <div
      className="messenger-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && closeMessenger()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Messages"
        className={cn(
          "messenger-window",
          showThread ? "messenger-window--thread" : "messenger-window--list",
          pokedFlash && "messenger-shell--poked",
        )}
      >
        {showThread ? threadView : listView}

        <NewChatDialog
          open={newChatOpen}
          onOpenChange={setNewChatOpen}
          slot={slot}
          search={userSearch}
          onSearchChange={setUserSearch}
          onSelectUser={(id) => startChat.mutate(id)}
          onPokeUser={(id) => poke.mutate(id)}
          starting={startChat.isPending}
          poking={poke.isPending}
        />
      </div>
    </div>
  );
}

function DetailsPanel({
  conversation,
  ticket,
  participants,
  closeButton,
}: {
  conversation: ConversationRecord;
  ticket: TicketRecord | undefined;
  participants: Participant[];
  closeButton: ReactNode;
}) {
  const isTicket = conversation.type === "ticket";
  return (
    <aside className="messenger-details">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{isTicket ? "Request details" : "Chat details"}</h3>
        {closeButton}
      </div>

      {isTicket ? (
        ticket ? (
          <dl className="messenger-detail-list">
            <DetailRow label="Form">{ticket.formTitle}</DetailRow>
            <DetailRow label="Division">
              {ticket.division ? (
                <span className="messenger-division-pill">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                  {ticket.division}
                </span>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Submitted">
              {new Date(ticket.createdAt)
                .toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
                .replace(/, (\d{1,2}:)/, " · $1")}
            </DetailRow>
            <DetailRow label="Assigned to">{formatAssignedPersonnel(ticket.assignedTo)}</DetailRow>
          </dl>
        ) : (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading request…
          </div>
        )
      ) : conversation.isGlobal ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {conversation.subtitle || "Group chat for the whole team."} Everyone with access sees
          messages here instantly.
        </p>
      ) : null}

      {participants.length > 0 ? (
        <div className="mt-1">
          <p className="messenger-detail-label">In this chat</p>
          <ul className="mt-3 space-y-3.5">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <RoleAvatar name={p.name} role={p.role} size="md" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <RolePill role={p.role} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="messenger-detail-row">
      <dt className="messenger-detail-label">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 1);
}

function RoleAvatar({
  name,
  role,
  size = "sm",
}: {
  name: string;
  role: ChatRole;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "messenger-role-avatar",
        `messenger-role-avatar--${role}`,
        size === "md" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs",
      )}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function RolePill({ role, rawRole = "" }: { role: ChatRole; rawRole?: string }) {
  return (
    <span className={cn("messenger-role-pill", `messenger-role-pill--${role}`)}>
      {chatRoleLabel(role, rawRole)}
    </span>
  );
}

function AvatarStack({ people }: { people: Participant[] }) {
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <div
      className="flex shrink-0 -space-x-2 max-md:hidden"
      title={people.map((p) => p.name).join(", ")}
    >
      {shown.map((p) => (
        <span key={p.id} className="rounded-full ring-2 ring-[var(--card)]">
          <RoleAvatar name={p.name} role={p.role} />
        </span>
      ))}
      {extra > 0 ? (
        <span className="messenger-role-avatar h-9 w-9 bg-muted text-xs text-muted-foreground ring-2 ring-[var(--card)]">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function ConversationTile({ conversation }: { conversation: ConversationRecord }) {
  return (
    <span
      className={cn(
        "messenger-tile",
        conversation.isGlobal
          ? "messenger-tile--team"
          : conversation.type === "ticket"
            ? "messenger-tile--ticket"
            : "messenger-tile--direct",
      )}
    >
      {conversation.isGlobal ? (
        <Users className="h-5 w-5" />
      ) : conversation.type === "ticket" ? (
        <Ticket className="h-5 w-5" />
      ) : (
        initials(conversation.title)
      )}
    </span>
  );
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function MessageList({
  messages,
  currentUserId,
  creatorId,
}: {
  messages: ConversationMessageRecord[];
  currentUserId: string;
  creatorId: string | null;
}) {
  return (
    <div className="flex flex-col">
      {messages.map((msg, index) => {
        const prev = messages[index - 1];
        const next = messages[index + 1];
        const at = new Date(msg.createdAt);
        const newDay = !prev || !sameDay(new Date(prev.createdAt), at);
        const startsGroup =
          newDay ||
          !prev ||
          prev.isSystem ||
          prev.senderId !== msg.senderId ||
          at.getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS;
        const endsGroup =
          !next ||
          next.isSystem ||
          next.senderId !== msg.senderId ||
          !sameDay(new Date(next.createdAt), at) ||
          new Date(next.createdAt).getTime() - at.getTime() > GROUP_GAP_MS;
        const isOwn = msg.senderId === currentUserId;
        const role = chatRole(msg.senderRole, msg.senderId, creatorId);

        return (
          <Fragment key={msg._id}>
            {newDay ? (
              <div className="messenger-day-divider">
                <span>{dayLabel(at)}</span>
              </div>
            ) : null}

            {msg.isSystem ? (
              <div className="my-2 flex justify-center">
                <span className="messenger-system-pill">
                  <MessageBody body={msg.body} />
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  "flex items-end gap-3",
                  isOwn ? "justify-end" : "justify-start",
                  startsGroup ? "mt-4" : "mt-2",
                )}
              >
                {!isOwn ? (
                  <div className="w-9 shrink-0">
                    {endsGroup ? <RoleAvatar name={msg.senderName} role={role} /> : null}
                  </div>
                ) : null}

                <div
                  className={cn(
                    "flex min-w-0 max-w-[80%] flex-col",
                    isOwn ? "items-end" : "items-start",
                  )}
                >
                  {startsGroup ? (
                    <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-semibold text-foreground">
                        {isOwn ? "You" : msg.senderName}
                      </span>
                      <RolePill role={role} rawRole={msg.senderRole} />
                      <time dateTime={msg.createdAt} className="text-muted-foreground">
                        {timeLabel(at)}
                      </time>
                    </p>
                  ) : null}
                  <div
                    title={at.toLocaleString()}
                    className={cn(
                      "messenger-bubble",
                      isOwn ? "messenger-bubble--own" : "messenger-bubble--other",
                    )}
                  >
                    <MessageBody body={msg.body} mentions={msg.mentions} />
                  </div>
                </div>
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function relativeShort(iso: string) {
  const date = new Date(iso);
  if (sameDay(date, new Date())) return timeLabel(date);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ConversationRow({
  conversation,
  active,
  unread = 0,
  onClick,
}: {
  conversation: ConversationRecord;
  active: boolean;
  unread?: number;
  onClick: () => void;
}) {
  const preview = conversation.lastMessagePreview
    ? `${conversation.lastSenderName ? `${conversation.lastSenderName}: ` : ""}${conversation.lastMessagePreview}`
    : conversation.subtitle || "No messages yet";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "messenger-conversation-row w-full text-left",
        active && "messenger-conversation-row--active",
      )}
    >
      <div className="flex items-center gap-3">
        <ConversationTile conversation={conversation} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold">{conversation.title}</span>
            {conversation.lastMessageAt ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {relativeShort(conversation.lastMessageAt)}
              </span>
            ) : null}
          </div>
          {conversation.type === "ticket" && conversation.subtitle ? (
            <p className="truncate text-xs text-muted-foreground/90">{conversation.subtitle}</p>
          ) : null}
          <p className={cn("truncate text-xs text-muted-foreground", unread > 0 && "font-semibold text-foreground")}>
            {preview}
          </p>
        </div>
        {unread > 0 ? (
          <span
            className="ml-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
            aria-label={`${unread} unread`}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function NewChatDialog({
  open,
  onOpenChange,
  slot,
  search,
  onSearchChange,
  onSelectUser,
  onPokeUser,
  starting,
  poking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: PortalSlot;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectUser: (userId: string) => void;
  onPokeUser: (userId: string) => void;
  starting: boolean;
  poking: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["messageable-users", slot],
    queryFn: () => api.listMessageableUsers(slot),
    enabled: open,
  });

  const users = data?.users ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.division.toLowerCase().includes(q),
      )
    : users;
  const grouped = groupUsersByRole(filtered);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Message or poke anyone: admin, records, or client.</DialogDescription>
        </DialogHeader>
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, email, or division…"
              className="pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-2 pb-4">
          {isLoading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Loading people…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No people found.</p>
          ) : (
            <>
              <UserSection
                title="Admin"
                users={grouped.admin}
                onSelect={onSelectUser}
                onPoke={onPokeUser}
                disabled={starting}
                pokeDisabled={poking}
              />
              <UserSection
                title="Clients"
                users={grouped.clients}
                onSelect={onSelectUser}
                onPoke={onPokeUser}
                disabled={starting}
                pokeDisabled={poking}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserSection({
  title,
  users,
  onSelect,
  onPoke,
  disabled,
  pokeDisabled,
}: {
  title: string;
  users: MessageableUser[];
  onSelect: (id: string) => void;
  onPoke: (id: string) => void;
  disabled: boolean;
  pokeDisabled: boolean;
}) {
  if (users.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {users.map((u) => (
        <div key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/60">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(u.id)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1.5 text-left disabled:opacity-50"
          >
            <RoleAvatar name={u.name} role={chatRole(u.role, u.id, null)} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {messageRoleLabel(u.role)} · {u.division}
              </p>
            </div>
          </button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 gap-1 px-2 text-xs"
            disabled={pokeDisabled}
            onClick={() => onPoke(u.id)}
            title={`Poke ${u.name}`}
          >
            <Hand className="h-3.5 w-3.5" />
            Poke
          </Button>
        </div>
      ))}
    </div>
  );
}
