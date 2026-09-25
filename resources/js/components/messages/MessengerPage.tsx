import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Hand, Loader2, MessageSquarePlus, Search, Send, Ticket, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WorkspacePageHeader } from "@/components/layout/workspace-ui";
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
} from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { groupUsersByRole, messageRoleLabel } from "@/lib/messages";
import { joinConversationRoom } from "@/lib/message-socket";
import { setActiveConversationId } from "@/lib/active-conversation";
import type { PortalSlot } from "@/lib/sessions";
import { cn } from "@/lib/utils";

type MessengerPageProps = {
  slot: PortalSlot;
  initialTicketId?: string;
  initialConversationId?: string;
};

const SCROLL_BOTTOM_THRESHOLD = 72;

export function MessengerPage({ slot, initialTicketId, initialConversationId }: MessengerPageProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [pokedFlash, setPokedFlash] = useState(false);
  const [newBelowCount, setNewBelowCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevLastMessageIdRef = useRef<string | null>(null);

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
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD;
    isAtBottomRef.current = atBottom;
    if (atBottom) setNewBelowCount(0);
  }, []);

  useEffect(() => {
    if (selectedId) joinConversationRoom(slot, selectedId);
  }, [slot, selectedId]);

  useEffect(() => {
    setActiveConversationId(slot, selectedId);
    return () => setActiveConversationId(slot, null);
  }, [slot, selectedId]);

  useEffect(() => {
    isAtBottomRef.current = true;
    setNewBelowCount(0);
    prevMessageCountRef.current = 0;
    prevLastMessageIdRef.current = null;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [selectedId, scrollToBottom]);

  const { data: convData, isLoading: convLoading } = useQuery({
    queryKey: ["conversations", slot],
    queryFn: () => api.listConversations(slot),
  });

  const conversations = convData?.items ?? [];

  useEffect(() => {
    if (!initialTicketId) return;
    let cancelled = false;
    void api.getTicketConversation(initialTicketId, slot).then((data) => {
      if (cancelled) return;
      setSelectedId(data.conversation._id);
      void qc.invalidateQueries({ queryKey: ["conversations", slot] });
    });
    return () => {
      cancelled = true;
    };
  }, [initialTicketId, slot, qc]);

  useEffect(() => {
    if (!initialConversationId || initialTicketId) return;
    setSelectedId(initialConversationId);
  }, [initialConversationId, initialTicketId]);

  const sortedConversations = useMemo(() => {
    const global = conversations.filter((c) => c.isGlobal);
    const tickets = conversations.filter((c) => c.type === "ticket");
    const rest = conversations.filter((c) => !c.isGlobal && c.type !== "ticket");
    return [...global, ...tickets, ...rest];
  }, [conversations]);

  const selected = useMemo(
    () => conversations.find((c) => c._id === selectedId) ?? null,
    [conversations, selectedId],
  );

  useEffect(() => {
    if (!selectedId && sortedConversations.length > 0 && !initialTicketId && !initialConversationId) {
      const global = sortedConversations.find((c) => c.isGlobal);
      setSelectedId(global?._id ?? sortedConversations[0]._id);
    }
  }, [sortedConversations, selectedId, initialTicketId, initialConversationId]);

  const { data: msgData, isLoading: msgLoading } = useQuery({
    queryKey: ["conversation-messages", selectedId, slot],
    queryFn: () => api.listConversationMessages(selectedId!, slot),
    enabled: Boolean(selectedId),
  });

  const messages = msgData?.items ?? [];

  const send = useMutation({
    mutationFn: () => api.postConversationMessage(selectedId!, draft.trim(), slot, mentionIds),
    onSuccess: (data) => {
      setDraft("");
      setMentionIds([]);
      if (selectedId && data.message) {
        const message = data.message as ConversationMessageRecord;
        qc.setQueryData(
          ["conversation-messages", selectedId, slot],
          (old: { items: ConversationMessageRecord[] } | undefined) => {
            const items = old?.items ?? [];
            if (items.some((m) => m._id === message._id)) return { items };
            return { items: [...items, message] };
          },
        );
        qc.setQueryData(
          ["conversations", slot],
          (old: { items: ConversationRecord[] } | undefined) => {
            if (!old) return old;
            return {
              items: old.items
                .map((conv) =>
                  conv._id === selectedId
                    ? {
                        ...conv,
                        lastMessageAt: message.createdAt,
                        lastMessagePreview: message.body,
                        lastSenderName: message.senderName,
                      }
                    : conv,
                )
                .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")),
            };
          },
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
      setSelectedId(data.conversation._id);
    },
    onError: (err: Error) => toast.error(err.message || "Could not start chat"),
  });

  const poke = useMutation({
    mutationFn: (userId: string) => api.pokeUser(userId, slot),
    onSuccess: (_data, userId) => {
      const target = selected?.otherUser?.id === userId ? selected.otherUser.name : "them";
      toast.success(`Poked ${target}!`);
    },
    onError: (err: Error) => toast.error(err.message || "Could not send poke"),
  });

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const atBottom = entry.isIntersecting;
        isAtBottomRef.current = atBottom;
        if (atBottom) setNewBelowCount(0);
      },
      { root, threshold: 0, rootMargin: "1px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [selectedId, messages.length, msgLoading]);

  useEffect(() => {
    const count = messages.length;
    const lastId = messages[count - 1]?._id ?? null;

    if (msgLoading) return;

    if (count === 0) {
      prevMessageCountRef.current = 0;
      prevLastMessageIdRef.current = null;
      return;
    }

    const isFirstBatch =
      prevMessageCountRef.current === 0 || prevLastMessageIdRef.current === null;
    const hasNewTail = lastId !== prevLastMessageIdRef.current;
    const added = hasNewTail ? Math.max(count - prevMessageCountRef.current, 1) : 0;

    prevMessageCountRef.current = count;
    prevLastMessageIdRef.current = lastId;

    if (isFirstBatch) {
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }

    if (!hasNewTail || added === 0) return;

    const lastMessage = messages[messages.length - 1];
    const isOwnMessage = lastMessage?.senderId === user?.id;

    if (isAtBottomRef.current || isOwnMessage) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } else {
      setNewBelowCount((current) => current + added);
    }
  }, [messages, msgLoading, user?.id, scrollToBottom]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ slot: PortalSlot }>).detail;
      if (detail?.slot !== slot) return;
      setPokedFlash(true);
      window.setTimeout(() => setPokedFlash(false), 1200);
    };
    window.addEventListener("nmp-poke-notification", handler);
    return () => window.removeEventListener("nmp-poke-notification", handler);
  }, [slot]);

  const handleSubmit = () => {
    const body = draft.trim();
    if (!body || !selectedId || send.isPending) return;
    send.mutate();
  };

  if (!user) return null;

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Messages"
        description="Real-time group chat and direct messages with admin, records, and clients."
      />

      <div
        className={cn(
          "messenger-shell data-panel overflow-hidden",
          pokedFlash && "messenger-shell--poked",
        )}
      >
        <aside className="messenger-sidebar border-r border-border/70">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <h2 className="text-sm font-semibold">Chats</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setNewChatOpen(true)}
              className="h-8 gap-1.5 px-2.5"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>

          <div className="messenger-conversation-list">
            {convLoading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading chats…</p>
            ) : sortedConversations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No chats yet.</p>
            ) : (
              sortedConversations.map((conv) => (
                <ConversationRow
                  key={conv._id}
                  conversation={conv}
                  active={conv._id === selectedId}
                  onClick={() => setSelectedId(conv._id)}
                />
              ))
            )}
          </div>
        </aside>

        <section className="messenger-thread flex min-h-0 flex-col overflow-hidden">
          {selected ? (
            <>
              <header className="messenger-thread-header shrink-0 border-b border-border/70 px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        selected.isGlobal
                          ? "bg-primary/12 text-primary"
                          : selected.type === "ticket"
                            ? "bg-amber-500/12 text-amber-700"
                            : "bg-muted text-foreground",
                      )}
                    >
                      {selected.isGlobal ? (
                        <Users className="h-4 w-4" />
                      ) : selected.type === "ticket" ? (
                        <Ticket className="h-4 w-4" />
                      ) : (
                        <span className="text-sm font-semibold">
                          {selected.title.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold leading-tight">{selected.title}</h3>
                      {selected.subtitle ? (
                        <p className="truncate text-xs text-muted-foreground">{selected.subtitle}</p>
                      ) : null}
                      {selected.type === "ticket" && selected.threadParticipants ? (
                        <p className="truncate text-[11px] text-muted-foreground/80">
                          {selected.threadParticipants}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {selected.otherUser ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5"
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
                </div>
              </header>

              <div className="relative min-h-0 flex-1 overflow-hidden">
                <div
                  ref={scrollRef}
                  onScroll={handleMessagesScroll}
                  className="messenger-messages-scroll h-full overflow-y-auto px-4 py-4 sm:px-5"
                >
                {msgLoading ? (
                  <p className="text-sm text-muted-foreground">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {selected.isGlobal
                      ? "Say hello to the team — messages appear instantly for everyone."
                      : "No messages yet. Send the first message."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                  {messages.map((msg) => {
                    const isOwn = msg.senderId === user.id;
                    if (msg.isSystem) {
                      return (
                        <div key={msg._id} className="py-1">
                          <MessageBody body={msg.body} isSystem />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={msg._id}
                        className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "ticket-message-bubble max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                            isOwn ? "ticket-message-bubble--own" : "ticket-message-bubble--other",
                          )}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <span className="font-semibold">{msg.senderName}</span>
                            <span className="opacity-70">{messageRoleLabel(msg.senderRole)}</span>
                            <span className="opacity-60">
                              {new Date(msg.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <MessageBody body={msg.body} mentions={msg.mentions} />
                        </div>
                      </div>
                    );
                  })}
                  </div>
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
                className="messenger-composer shrink-0 border-t border-border/70 px-4 py-4 sm:px-5"
              >
                <MessageComposer
                  slot={slot}
                  conversationId={selectedId}
                  value={draft}
                  onChange={setDraft}
                  mentionIds={mentionIds}
                  onMentionIdsChange={setMentionIds}
                  onSubmit={handleSubmit}
                  disabled={send.isPending}
                  placeholder={
                    selected.isGlobal
                      ? "Message the NMP team…"
                      : selected.type === "ticket"
                      ? "Message about this request… @ admin, client, or assigned personnel"
                        : `Message ${selected.title}…`
                  }
                />
                <div className="mt-3 flex justify-end">
                  <Button type="submit" size="sm" disabled={!draft.trim() || send.isPending}>
                    {send.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">Select a chat</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Open the team group or start a new direct message with admin, records, or a client.
              </p>
            </div>
          )}
        </section>
      </div>

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
  );
}

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: ConversationRecord;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "messenger-conversation-row w-full text-left",
        active && "messenger-conversation-row--active",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            conversation.isGlobal
              ? "bg-primary/12 text-primary"
              : conversation.type === "ticket"
                ? "bg-amber-500/12 text-amber-700"
                : "bg-muted",
          )}
        >
          {conversation.isGlobal ? (
            <Users className="h-4 w-4" />
          ) : conversation.type === "ticket" ? (
            <Ticket className="h-4 w-4" />
          ) : (
            conversation.title.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{conversation.title}</span>
            {conversation.lastMessageAt ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {new Date(conversation.lastMessageAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            ) : null}
          </div>
          {conversation.subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{conversation.subtitle}</p>
          ) : null}
          {conversation.lastMessagePreview ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {conversation.lastSenderName ? `${conversation.lastSenderName}: ` : ""}
              {conversation.lastMessagePreview}
            </p>
          ) : null}
        </div>
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
          <DialogDescription>
            Message or poke anyone — admin, records, or client.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, email, or division…"
              className="pl-9"
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
        <div
          key={u.id}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/60"
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(u.id)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1.5 text-left disabled:opacity-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {u.name.charAt(0).toUpperCase()}
            </div>
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
