import { useQuery } from "@tanstack/react-query";
import { Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import type { MessageableUser } from "@/lib/api/types";
import { getMentionQuery, insertMention } from "@/lib/mentions-render";
import type { PortalSlot } from "@/lib/sessions";
import { cn } from "@/lib/utils";

type MessageComposerProps = {
  slot: PortalSlot;
  conversationId: string | null;
  value: string;
  onChange: (value: string) => void;
  mentionIds: string[];
  onMentionIdsChange: (ids: string[]) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Bordered box with an auto-growing input and a toolbar (@, hint, Send) — floating chat. */
  boxed?: boolean;
  autoFocus?: boolean;
  sending?: boolean;
};

const BOXED_MAX_HEIGHT = 160;

export function MessageComposer({
  slot,
  conversationId,
  value,
  onChange,
  mentionIds,
  onMentionIdsChange,
  onSubmit,
  disabled,
  placeholder,
  boxed = false,
  autoFocus = false,
  sending = false,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const { data } = useQuery({
    queryKey: ["mentionable-users", conversationId, slot],
    queryFn: () => api.listMentionableUsers(conversationId!, slot),
    enabled: Boolean(conversationId),
  });

  const users = data?.users ?? [];
  const cursor = textareaRef.current?.selectionStart ?? value.length;
  const mentionQuery = getMentionQuery(value, cursor);
  const showMentions = mentionQuery !== null;

  const filtered = useMemo(() => {
    if (!showMentions) return [];
    const q = mentionQuery.trim().toLowerCase();
    return users
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.division.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [users, mentionQuery, showMentions]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery, conversationId]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus, conversationId]);

  // Grow with the text in the boxed layout, up to a few lines.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!boxed || !el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), BOXED_MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > BOXED_MAX_HEIGHT ? "auto" : "hidden";
  }, [boxed, value]);

  /** Toolbar "@" button: insert @ at the cursor so the mention picker opens. */
  const startMention = () => {
    const el = textareaRef.current;
    const pos = el?.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const insert = `${needsSpace ? " " : ""}@`;
    onChange(before + insert + value.slice(pos));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const next = pos + insert.length;
      el.setSelectionRange(next, next);
    });
  };

  const pickMention = (user: MessageableUser) => {
    const el = textareaRef.current;
    const pos = el?.selectionStart ?? value.length;
    const { nextValue, cursor: nextCursor } = insertMention(value, pos, user.name);
    onChange(nextValue);
    if (!mentionIds.includes(user.id)) {
      onMentionIdsChange([...mentionIds, user.id]);
    }
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(filtered[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      {showMentions && filtered.length > 0 ? (
        <div className="mention-picker">
          {filtered.map((user, index) => (
            <button
              key={user.id}
              type="button"
              className={cn("mention-picker-item", index === mentionIndex && "mention-picker-item--active")}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMention(user);
              }}
            >
              <span className="font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">{user.division}</span>
            </button>
          ))}
        </div>
      ) : null}

      {boxed ? (
        <div className="messenger-input">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={2}
            maxLength={4000}
            disabled={disabled}
            className="min-h-0 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
            onKeyDown={handleKeyDown}
            aria-label="Message"
          />
          <div className="messenger-input-toolbar">
            <button
              type="button"
              onClick={startMention}
              className="messenger-icon-btn font-semibold text-maroon"
              title="Mention someone"
              aria-label="Mention someone"
              disabled={disabled}
            >
              @
            </button>
            <span className="ml-auto text-xs text-muted-foreground max-sm:hidden">
              Enter to send
            </span>
            <Button
              type="submit"
              size="sm"
              className="h-9 gap-1.5 rounded-xl px-5 font-semibold"
              disabled={!value.trim() || sending}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send
              {!sending ? <SendHorizontal className="h-4 w-4" /> : null}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={2}
            maxLength={4000}
            disabled={disabled}
            className="resize-none"
            onKeyDown={handleKeyDown}
          />
          <p className="mt-2 text-xs text-muted-foreground">Type @ to mention · Enter to send</p>
        </>
      )}
    </div>
  );
}
