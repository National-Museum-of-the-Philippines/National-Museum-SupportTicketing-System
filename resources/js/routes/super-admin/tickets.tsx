import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, StatusBadge, WorkspacePageHeader } from "@/components/layout/workspace-ui";
import { api } from "@/lib/api/client";
import type { SuperAdminTicketRow } from "@/lib/api/client";
import { timeAgo } from "@/lib/time-ago";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";

type Tab = "all" | "today" | "unassigned" | "overdue" | "reopened" | "closed";

type TicketsSearch = { tab?: Tab };

export const Route = createFileRoute("/super-admin/tickets")({
  validateSearch: (s: Record<string, unknown>): TicketsSearch => {
    const tabs: Tab[] = ["all", "today", "unassigned", "overdue", "reopened", "closed"];
    return { tab: tabs.includes(s.tab as Tab) ? (s.tab as Tab) : undefined };
  },
  component: AllTicketsPage,
});

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "New today" },
  { key: "unassigned", label: "Unassigned" },
  { key: "overdue", label: "Overdue" },
  { key: "reopened", label: "Reopened" },
  { key: "closed", label: "Closed" },
];

const STATUSES = [
  "pending_approval",
  "for_client_approval",
  "for_process_owner",
  "open",
  "in_progress",
  "resolved",
  "closed",
  "reopened",
  "rejected",
];

const PER_PAGE = 8;

const field =
  "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30";

function exportCsv(rows: SuperAdminTicketRow[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ["Ticket", "Form / Request", "Section", "Requested by", "Staff in charge", "Status", "Submitted"].join(","),
    ...rows.map((r) =>
      [
        r.ticketNumber,
        r.formTitle,
        r.section ?? "",
        r.creatorName,
        r.assignees.join("; "),
        r.status,
        r.createdAt ?? "",
      ]
        .map((v) => esc(String(v ?? "")))
        .join(","),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function pageList(current: number, count: number): (number | "…")[] {
  if (count <= 5) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(count - 1, current + 1);
  if (lo > 2) out.push("…");
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < count - 1) out.push("…");
  out.push(count);
  return out;
}

function AllTicketsPage() {
  const { canQuery } = useAdminSession();
  const { tab: initialTab } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(initialTab ?? "all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params: Record<string, string> = { tab, page: String(page), limit: String(PER_PAGE) };
  if (debounced.trim()) params.search = debounced.trim();
  if (sectionId) params.sectionId = sectionId;
  if (status) params.status = status;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["super-admin-tickets", params],
    queryFn: () => api.superAdminTickets(params),
    enabled: canQuery,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(page, pageCount);
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="page-shell space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <WorkspacePageHeader
          title="All Tickets"
          description="Every ticket from every section. Clients send them; you monitor."
        />
        <button
          type="button"
          onClick={() => exportCsv(items)}
          disabled={items.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-maroon/50 bg-card px-4 text-sm font-semibold text-maroon transition-colors hover:bg-maroon/5 disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
              tab === t.key
                ? "border-maroon bg-maroon text-white"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {t.label}
            <span className={cn("text-xs tabular-nums", tab === t.key ? "text-white/80" : "text-muted-foreground")}>
              {data?.counts[t.key] ?? "…"}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            placeholder="Search ticket no., client or form…"
            className={cn(field, "w-full pl-9")}
          />
        </label>
        <select value={sectionId} onChange={(e) => reset(setSectionId)(e.target.value)} className={cn(field, "max-w-[14rem]")}>
          <option value="">All sections</option>
          {data?.filters.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={field}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        {isError ? (
          <EmptyState
            title="Could not load tickets"
            description={error instanceof Error ? error.message : "Try again later."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Form / Request</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Requested by</th>
                  <th className="px-4 py-3">Staff in charge</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      Loading tickets…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="No tickets match" description="Try a different tab or clear a filter." />
                    </td>
                  </tr>
                ) : (
                  items.map((t) => (
                    <tr key={t._id} className="border-t border-border/70 align-top">
                      <td className="px-4 py-2.5">
                        <span className="whitespace-nowrap font-mono text-xs font-semibold text-maroon">{t.ticketNumber}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-foreground">{t.formTitle}</p>
                        {t.overdueDays > 0 ? (
                          <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[0.65rem] font-semibold text-red-700">
                            {t.overdueDays} d late
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{t.section ?? "—"}</td>
                      <td className="px-4 py-2.5">{t.creatorName}</td>
                      <td className="px-4 py-2.5">
                        {t.assignees.length ? (
                          t.assignees.join(", ")
                        ) : (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{timeAgo(t.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "No tickets"
              : `Showing ${(current - 1) * PER_PAGE + 1}–${Math.min(total, current * PER_PAGE)} of ${total} tickets · newest first`}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => setPage(current - 1)}
              disabled={current <= 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageList(current, pageCount).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold tabular-nums",
                    p === current ? "border-maroon bg-maroon text-white" : "border-border hover:bg-muted",
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
