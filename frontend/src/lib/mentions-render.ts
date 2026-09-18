import type { MessageMention } from "@/lib/api/types";

export function insertMention(
  value: string,
  selectionStart: number,
  userName: string,
): { nextValue: string; cursor: number } {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionStart);
  const atIndex = before.lastIndexOf("@");
  const prefix = atIndex >= 0 ? before.slice(0, atIndex) : before;
  const mentionText = `@${userName} `;
  const nextValue = `${prefix}${mentionText}${after}`;
  const cursor = (prefix + mentionText).length;
  return { nextValue, cursor };
}

export function getMentionQuery(value: string, cursor: number) {
  const before = value.slice(0, cursor);
  const match = /(^|\s)@([^\s@]*)$/.exec(before);
  if (!match) return null;
  return match[2] ?? "";
}

export function renderMessageBody(body: string, mentions: MessageMention[] = []) {
  if (!mentions.length) return body;

  const names = [...mentions]
    .map((m) => m.userName)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (!names.length) return body;

  const pattern = new RegExp(`@(${names.join("|")})`, "g");
  const parts: Array<string | { mention: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index));
    parts.push({ mention: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) parts.push(body.slice(lastIndex));

  return parts;
}
