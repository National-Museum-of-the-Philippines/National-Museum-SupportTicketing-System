import { FileText, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityRecord } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return "";

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function EntityChip({ type }: { type: string }) {
  const key = type.trim().toLowerCase();
  const isTicket = key === "ticket";
  const isForm = key === "form";
  const Icon = isTicket ? Ticket : FileText;
  const label = isTicket ? "Ticket" : isForm ? "Form" : type || "Event";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[0.7rem] font-semibold tracking-wide",
        isTicket && "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
        isForm && "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80",
        !isTicket && !isForm && "bg-muted text-muted-foreground ring-1 ring-border/80",
      )}
    >
      <Icon className="h-3.5 w-3.5 opacity-80" aria-hidden />
      {label}
    </span>
  );
}

export function ActivityFeed({
  items,
  empty,
  denser = false,
}: {
  items: ActivityRecord[];
  empty?: ReactNode;
  denser?: boolean;
}) {
  if (!items.length) return <>{empty ?? null}</>;

  return (
    <ul className="divide-y divide-border/70">
      {items.map((row) => {
        const when = new Date(row.createdAt);
        const absolute = when.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        const relative = formatRelativeTime(row.createdAt);

        return (
          <li
            key={row._id}
            className={cn(
              "group flex items-start gap-3 transition-colors hover:bg-maroon/[0.03]",
              denser ? "px-3 py-3 sm:px-4" : "px-4 py-3.5 sm:px-5",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                row.entityType?.toLowerCase() === "ticket"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-sky-50 text-sky-800",
              )}
              aria-hidden
            >
              {row.entityType?.toLowerCase() === "ticket" ? (
                <Ticket className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                <p className="text-[0.925rem] font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                  {row.summary}
                </p>
                {row.entityType ? <EntityChip type={row.entityType} /> : null}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">{row.actorName || "System"}</span>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <time dateTime={row.createdAt} title={absolute}>
                  {relative}
                </time>
                <span className="hidden text-muted-foreground/80 sm:inline" aria-hidden>
                  ·
                </span>
                <span className="hidden text-muted-foreground/80 sm:inline">{absolute}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
