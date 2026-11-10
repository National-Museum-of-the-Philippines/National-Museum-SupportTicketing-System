import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PanelLoading } from "@/components/layout/workspace-ui";
import type { NotificationItem } from "@/lib/notifications";
import { formatNotificationTime } from "@/lib/notifications";
import { isMessagesPath, messengerTargetFromSearch, openMessenger } from "@/lib/messenger-store";
import { cn } from "@/lib/utils";

type NotificationBellProps = {
  items: NotificationItem[];
  viewAllTo?: string;
  emptyMessage?: string;
  loading?: boolean;
};

const SEEN_KEY = "notification-bell-seen";

export function NotificationBell({
  items,
  viewAllTo,
  emptyMessage = "No new notifications",
  loading = false,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });
  const total = items.length;
  const count = items.filter((i) => !seen.has(String(i.id))).length;

  // Opening the bell marks everything currently listed as seen.
  useEffect(() => {
    if (!open || loading || total === 0) return;
    setSeen((prev) => {
      const next = new Set(prev);
      for (const i of items) next.add(String(i.id));
      if (next.size === prev.size) return prev;
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-500)));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, [open, loading, items, total]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "header-icon-btn",
          open ? "header-icon-btn-active" : "text-muted-foreground",
        )}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-dropdown absolute right-0 z-50 mt-2 w-80 sm:w-96">
          <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Checking for updates…"
                  : total > 0
                    ? `${total} item${total === 1 ? "" : "s"}`
                    : "You're all caught up"}
              </p>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <PanelLoading label="Loading notifications…" />
            ) : total === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {items.map((item) => (
                  <li key={item.id}>
                    {isMessagesPath(item.to) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          openMessenger(messengerTargetFromSearch(item.search));
                        }}
                        className="notification-item w-full text-left"
                      >
                        <NotificationItemBody item={item} />
                      </button>
                    ) : (
                      <Link
                        to={item.to}
                        {...(item.params ? { params: item.params } : {})}
                        {...(item.search ? { search: item.search } : {})}
                        onClick={() => setOpen(false)}
                        className="notification-item"
                      >
                        <NotificationItemBody item={item} />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {viewAllTo && total > 0 ? (
            <div className="border-t border-border bg-muted/20 px-4 py-2.5">
              <Link
                to={viewAllTo}
                onClick={() => setOpen(false)}
                className="block text-center text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NotificationItemBody({ item }: { item: NotificationItem }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {item.message}
        </p>
      </div>
      {item.time ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatNotificationTime(item.time)}
        </span>
      ) : null}
    </div>
  );
}
