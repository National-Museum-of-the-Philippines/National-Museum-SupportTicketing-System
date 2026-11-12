import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, StatusBadge } from "@/components/layout/workspace-ui";
import { api, type SuperAdminInsights } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border border-border/80 bg-card shadow-sm";
const field =
  "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30";
const ACCENTS = ["#7a1230", "#1f6f8b", "#b8892e", "#2f6b3f", "#8a4a5f", "#4a6fa5", "#6b5b73", "#a05a2c"];

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

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  const btn =
    "inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} disabled={page <= 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="h-4 w-4" /> Prev
      </button>
      <span className="text-xs text-muted-foreground">
        Page {page + 1} of {pageCount}
      </span>
      <button
        type="button"
        className={btn}
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
      >
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ───────────── Divisions: completed requests per division ───────────── */

const CARDS_PER_PAGE = 8;

export function DivisionsView({
  insights,
  onOpen,
}: {
  insights: SuperAdminInsights;
  onOpen: (divisionName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const withDone = insights.divisions
    .filter((d) => d.completed > 0)
    .filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.completed - a.completed);

  const pageCount = Math.max(1, Math.ceil(withDone.length / CARDS_PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const visible = withDone.slice(current * CARDS_PER_PAGE, (current + 1) * CARDS_PER_PAGE);
  const totalDone = insights.divisions.reduce((n, d) => n + d.completed, 0);
  const idle = insights.divisions.filter((d) => d.completed === 0).length;

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search division…"
          className={cn(field, "w-full pl-9")}
        />
      </label>

      {visible.length === 0 ? (
        <EmptyState
          title="No completed requests"
          description="Divisions appear here once they have completed requests."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((d, i) => (
            <button
              key={d.name}
              type="button"
              onClick={() => onOpen(d.name)}
              className={cn(
                card,
                "flex flex-col border-t-4 p-4 text-left transition-shadow hover:shadow-md",
              )}
              style={{ borderTopColor: ACCENTS[(current * CARDS_PER_PAGE + i) % ACCENTS.length] }}
            >
              <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">
                {d.name}
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{d.parent ?? " "}</p>
              <p
                className="mt-3 font-serif text-4xl font-bold tabular-nums"
                style={{ color: ACCENTS[(current * CARDS_PER_PAGE + i) % ACCENTS.length] }}
              >
                {d.completed}
              </p>
              <p className="text-xs text-muted-foreground">completed requests</p>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                <span>{plural(d.total, "request")} total</span>
                <span className="font-semibold text-maroon">Open ›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {plural(withDone.length, "division")} with completed requests · {plural(totalDone, "completed request")}
          {idle > 0 ? ` · ${idle} with none yet` : ""}
        </p>
        <Pager page={current} pageCount={pageCount} onPage={setPage} />
      </div>
    </div>
  );
}

/* ───────────── Division dropdown: every request of one division ───────────── */

const ROWS_PER_PAGE = 8;

export function DivisionRequests({
  sectionId,
  sectionName,
}: {
  sectionId: string;
  sectionName: string;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setStatus("");
    setSearch("");
  }, [sectionId]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-division-requests", sectionId, term, status, page],
    queryFn: () =>
      api.superAdminTickets({
        sectionId,
        page: String(page),
        limit: String(ROWS_PER_PAGE),
        ...(term ? { search: term } : {}),
        ...(status ? { status } : {}),
      }),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const to = Math.min(total, page * ROWS_PER_PAGE);

  return (
    <section className={cn(card, "p-5")}>
      <h2 className="text-lg font-bold text-foreground">{sectionName}</h2>
      <p className="text-xs text-muted-foreground">All requests of this division</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket, client or request…"
            className={cn(field, "w-full pl-9")}
          />
        </label>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className={field}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/50 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="rounded-l-xl px-3 py-2.5">Ticket</th>
              <th className="px-3 py-2.5">Request type</th>
              <th className="px-3 py-2.5">Client</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Submitted</th>
              <th className="rounded-r-xl px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Loading requests…
                </td>
              </tr>
            ) : (data?.items ?? []).length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title="No requests found"
                    description="This division has no requests matching these filters."
                  />
                </td>
              </tr>
            ) : (
              data!.items.map((t) => (
                <tr key={t._id} className="border-t border-border/60">
                  <td className="px-3 py-3 font-mono text-xs">{t.ticketNumber}</td>
                  <td className="px-3 py-3">{t.formTitle}</td>
                  <td className="px-3 py-3">{t.creatorName}</td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={t.overdueDays > 0 ? "overdue" : t.status}
                      label={t.overdueDays > 0 ? "Overdue" : undefined}
                    />
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      to="/admin/requests/$ticketId"
                      params={{ ticketId: t._id }}
                      className="text-xs font-semibold text-maroon hover:underline"
                    >
                      View ›
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {from}–{to} of {plural(total, "request")}
        </p>
        <Pager page={page - 1} pageCount={pageCount} onPage={(p) => setPage(p + 1)} />
      </div>
    </section>
  );
}
