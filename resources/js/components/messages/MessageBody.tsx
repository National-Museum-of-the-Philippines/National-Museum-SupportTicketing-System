import type { MessageMention } from "@/lib/api/types";
import { renderMessageBody } from "@/lib/mentions-render";
import { cn } from "@/lib/utils";

export function MessageBody({
  body,
  mentions = [],
  isSystem = false,
  className,
}: {
  body: string;
  mentions?: MessageMention[];
  isSystem?: boolean;
  className?: string;
}) {
  if (isSystem) {
    return (
      <p className={cn("text-center text-xs italic text-muted-foreground", className)}>{body}</p>
    );
  }

  const parts = renderMessageBody(body, mentions);

  if (typeof parts === "string") {
    return <p className={cn("whitespace-pre-wrap break-words", className)}>{parts}</p>;
  }

  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <span key={`${index}-text`}>{part}</span>
        ) : (
          <span key={`${index}-mention`} className="message-mention">
            @{part.mention}
          </span>
        ),
      )}
    </p>
  );
}
