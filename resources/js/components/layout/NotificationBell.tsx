import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PanelLoading } from "@/components/layout/workspace-ui";
import type { NotificationItem } from "@/lib/notifications";
import { formatNotificationTime } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type NotificationBellProps = {
  items: NotificationItem[];
  viewAllTo?: string;
  emptyMessage?: string;
  loading?: boolean;
};

export function NotificationBell({
  items,
  viewAllTo,
  emptyMessage = "No new notifications",
  loading = false,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = items.length;

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
                  : count > 0
                    ? `${count} new item${count === 1 ? "" : "s"}`
                    : "You're all caught up"}
              </p>
            </div>
            {count > 0 ? (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <PanelLoading label="Loading notifications…" />
            ) : count === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.to}
                      {...(item.params ? { params: item.params } : {})}
                      {...(item.search ? { search: item.search } : {})}
                      onClick={() => setOpen(false)}
                      className="notification-item"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.title}
                          </p>
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
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {viewAllTo && count > 0 ? (
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
