import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
};

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
    </div>
  );
}
