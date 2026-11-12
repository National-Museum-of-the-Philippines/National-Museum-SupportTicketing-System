import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, BarChart3, CheckCircle2, Download, MessageSquare, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DataPanel,
  EmptyState,
  FormSelect,
  LoadingRows,
  StatCard,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { ColumnChart, ColumnLabels } from "@/components/layout/report-cards";
import { api, type DivisionStatsResponse } from "@/lib/api/client";
import type { TicketRecord } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";
import { DivisionRequests, DivisionsView } from "@/components/reports/DivisionReports";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/super-admin/reports")({
  component: ReportsPage,
});

// Categorical slots in fixed order (maroon first); the rest fold into one gray slice.
const DONUT_COLORS = ["#b8325a", "#e3a33b", "#3e7cb1", "#2fa58a", "#8a6fd1"];
const DONUT_OTHER = "#7b8794";

type DivisionStats = DivisionStatsResponse["divisions"][number];

function DivisionDonut({ division }: { division: DivisionStats }) {
  // One chart per division: the same option on different forms (e.g. "Website Update") adds up.
  const merged = new Map<string, number>();
  for (const form of division.forms) {
    for (const field of form.fields) {
      for (const o of field.options) merged.set(o.name, (merged.get(o.name) ?? 0) + o.count);
    }
  }
  const rows = [...merged]
    .map(([name, count]) => ({ name, count }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);
  const closed = division.closedRequests;
  const sum = rows.reduce((n, o) => n + o.count, 0);
  const coloured = rows.map((o, i) => ({ ...o, color: DONUT_COLORS[i] ?? DONUT_OTHER }));
  const slices = [
    ...coloured.filter((o) => o.color !== DONUT_OTHER),
    ...(coloured.some((o) => o.color === DONUT_OTHER)
      ? [
          {
            name: "Other",
            count: coloured.filter((o) => o.color === DONUT_OTHER).reduce((n, o) => n + o.count, 0),
            color: DONUT_OTHER,
          },
        ]
      : []),
  ];
  const r = 62;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="relative mx-auto aspect-square w-full max-w-[9rem]">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={`${division.name} closed requests`}>
          <circle cx="80" cy="80" r={r} fill="none" stroke="currentColor" strokeWidth="28" className="text-muted/60" />
          {sum > 0
            ? slices.map((o) => {
                const len = (o.count / sum) * circ;
                const el = (
                  <circle
                    key={o.name}
                    cx="80"
                    cy="80"
                    r={r}
                    fill="none"
                    stroke={o.color}
                    strokeWidth="28"
                    strokeDasharray={`${Math.max(len - 2, 0.5)} ${circ}`}
                    strokeDashoffset={-offset}
                  >
                    <title>{`${o.name}: ${o.count}`}</title>
                  </circle>
                );
                offset += len;
                return el;
              })
            : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">Total Closed</span>
          <span className="text-2xl font-bold leading-tight">{closed}</span>
        </div>
      </div>

      <div className="relative mt-3 border-t border-border/70">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No closed requests to count yet.
          </p>
        ) : (
          <ul className="max-h-44 divide-y divide-border/50 overflow-y-auto pr-1">
            {coloured.map((o) => (
              <li key={o.name} className="flex items-center gap-2 py-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
                <span className="min-w-0 flex-1 text-sm">{o.name}</span>
                <span className="text-sm font-semibold tabular-nums">{o.count}</span>
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {closed > 0 ? `${((o.count / closed) * 100).toFixed(1)}%` : "0%"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 5 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-card to-transparent pb-1 pt-6">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              <ArrowDown className="h-3.5 w-3.5" />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const PERIODS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "6w", label: "Last 6 weeks", days: 42 },
  { value: "3m", label: "Last 3 months", days: 90 },
  { value: "all", label: "All time", days: null },
] as const;

const PENDING_STATUSES = ["pending_approval", "for_process_owner", "for_client_approval"];
const TYPE_COLORS = ["#c23b66", "#e3a33b", "#5c0f1f", "#3e7cb1", "#2fa58a", "#8a6fd1"];
const DEFAULT_REQUEST_TYPES = [
  "Website Update",
  "Information System",
  "Event Assistance",
  "Network/Hardware Troubleshooting",
  "Software Troubleshooting",
  "Others",
];

const DAY_MS = 86_400_000;

async function fetchAllTickets() {
  const all: TicketRecord[] = [];
  for (let page = 1; page <= 40; page++) {
    const res = await api.listTickets({ limit: "50", page: String(page) }, "admin");
    all.push(...res.items);
    if (all.length >= res.total || res.items.length === 0) break;
  }
  return all;
}

function exportCsv(rows: TicketRecord[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Ticket", "Request type", "Client", "Division", "Status", "Submitted", "Updated", "Rating"],
    ...rows.map((t) => [
      t.ticketNumber,
      t.formTitle,
      t.creatorName,
      t.division,
      t.status,
      t.createdAt,
      t.updatedAt,
      t.feedbackRating ?? "",
    ]),
  ].map((r) => r.map(esc).join(","));
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { canQuery } = useAdminSession();
  const resty = true;
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("6w");
  const { data: allTickets, isLoading } = useQuery({
    queryKey: ["report-tickets"],
    queryFn: fetchAllTickets,
    enabled: canQuery,
  });

  const all = allTickets ?? [];
  const [tab, setTab] = useState<"overview" | "divisions" | "requests">("overview");
  const [sectionId, setSectionId] = useState("");
  const { data: overview } = useQuery({
    queryKey: ["report-super-admin-overview"],
    queryFn: () => api.superAdminOverview(),
    enabled: canQuery,
  });
  const { data: sectionList } = useQuery({
    queryKey: ["report-sections"],
    queryFn: () => api.superAdminTickets({ limit: "1" }),
    enabled: canQuery,
    select: (r) => r.filters.sections,
  });
  const insights = overview?.insights;
  const sections = sectionList ?? [];
  const activeSection = sections.find((s) => s.id === sectionId);
  const openDivision = (name: string) => {
    const match = sections.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (match) {
      setSectionId(match.id);
      setTab("requests");
    }
  };

  const periodDays = PERIODS.find((p) => p.value === period)?.days ?? undefined;
  const { data: divisionStats, isLoading: statsLoading } = useQuery({
    queryKey: ["division-stats", periodDays ?? "all"],
    queryFn: () => api.divisionStats("admin", periodDays),
    enabled: canQuery,
  });

  const items = useMemo(() => {
    const days = PERIODS.find((p) => p.value === period)?.days;
    const base = allTickets ?? [];
    if (days == null) return base;
    const since = Date.now() - days * DAY_MS;
    return base.filter((t) => new Date(t.createdAt).getTime() >= since);
  }, [allTickets, period]);

  const feedbackItems = items
    .filter((t) => t.feedbackSubmitted)
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime(),
    );
  const ratings = feedbackItems.map((t) => t.feedbackRating).filter((r): r is number => !!r);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return (
    <div className="page-shell">
      {resty ? (
        <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Reports &amp; Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading requests…"
              : `Four views of the same ${items.length} request${items.length === 1 ? "" : "s"}, side by side.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="report-period" className="text-xs font-medium text-muted-foreground">
            Period
          </label>
          <FormSelect
            id="report-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
            className="w-auto min-w-[9.5rem]"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </FormSelect>
          <button
            type="button"
            onClick={() => exportCsv(items)}
            disabled={items.length === 0}
            className={cn(buttonVariants({ size: "default" }), "gap-2 shadow-sm")}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-3">
        {(
          [
            ["overview", "Overview"],
            ["divisions", "Divisions"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "h-9 rounded-xl px-4 text-sm font-semibold transition-colors",
              tab === key ? "bg-maroon text-white" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
        <FormSelect
          aria-label="Choose a division"
          value={sectionId}
          onChange={(e) => {
            setSectionId(e.target.value);
            setTab(e.target.value ? "requests" : "overview");
          }}
          className={cn(
            "w-auto min-w-[14rem] max-w-[22rem]",
            tab === "requests" && "border-maroon ring-1 ring-maroon/30",
          )}
        >
          <option value="">Division requests…</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FormSelect>
      </div>

      {tab === "divisions" && insights ? (
        <DivisionsView insights={insights} onOpen={openDivision} />
      ) : null}
      {tab === "requests" && activeSection ? (
        <DivisionRequests sectionId={activeSection.id} sectionName={activeSection.name} />
      ) : null}

      {tab === "overview" && insights ? (
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold text-foreground">Requests per month</h2>
          <p className="mb-3 text-xs text-muted-foreground">Closed requests across all divisions</p>
          <ColumnChart bars={insights.monthly.map((m) => ({ label: m.label, value: m.closed }))} />
          <ColumnLabels labels={insights.monthly.map((m) => m.label)} />
        </div>
      ) : null}

        </>
      ) : (
        <>
      <WorkspacePageHeader
        title="Reports & Analytics"
        description="Overview of request volume, completion, and client feedback across the Support Ticketing System workflow."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total requests" value={all.length} hint="All client submissions" icon={Ticket} loading={isLoading} />
        <StatCard label="Pending approval" value={all.filter((t) => PENDING_STATUSES.includes(t.status)).length} hint="Awaiting admin review" icon={BarChart3} loading={isLoading} />
        <StatCard label="Closed" value={all.filter((t) => t.status === "closed").length} hint="Fully resolved requests" icon={CheckCircle2} loading={isLoading} />
        <StatCard label="With feedback" value={all.filter((t) => t.feedbackSubmitted).length} hint="Clients who submitted feedback" icon={MessageSquare} loading={isLoading} />
      </div>
        </>
      )}

      {resty ? null : (
        <>
      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(divisionStats?.divisions ?? []).map((division) => (
        <DataPanel
          key={division.name}
          className="flex h-full flex-col"
          title={division.name}
          description={`${division.closedRequests} closed of ${division.totalRequests} requests. Counts are closed tickets only.`}
        >
          <div className="flex flex-1 flex-col justify-center p-4 sm:p-5">
            {division.forms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No published forms are owned by this division yet, so there is nothing to count.
              </p>
            ) : (
              <DivisionDonut division={division} />
            )}
          </div>
        </DataPanel>
      ))}
      </div>
      {divisionStats?.excluded ? (
        <DataPanel
          title={divisionStats.myDivision}
          description="Division statistics are not tracked for this office."
        >
          <p className="p-4 text-sm text-muted-foreground sm:p-5">
            The Office of the Director-General and the regional component museums are not part
            of the per-division statistics.
          </p>
        </DataPanel>
      ) : null}
      {statsLoading ? <LoadingRows cols={2} /> : null}
        </>
      )}

      {resty && tab === "overview" ? (
        <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
            <h2 className="text-lg font-bold text-foreground">
              Client feedback comments ({feedbackItems.length})
            </h2>
            {avgRating != null ? (
              <p className="text-sm text-muted-foreground">
                Average rating <strong className="text-foreground">{avgRating.toFixed(1)}</strong> out of 5
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-between border-y border-border/70 bg-muted/40 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Ticket</span>
            <span>Action</span>
          </div>
          {isLoading ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">Loading feedback…</p>
          ) : feedbackItems.length === 0 ? (
            <div className="px-6 py-2">
              <EmptyState
                title="No feedback yet"
                description="Client comments appear here after they confirm feedback on a completed service."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {feedbackItems.map((t) => (
                <li key={t._id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                  <span className="font-mono text-sm text-foreground">{t.ticketNumber}</span>
                  <Link
                    to="/admin/requests/$ticketId"
                    params={{ ticketId: t._id }}
                    className="inline-flex items-center gap-2 rounded-lg bg-maroon/10 px-4 py-2 text-sm font-semibold text-maroon transition-colors hover:bg-maroon/15"
                  >
                    View request <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
      <DataPanel title={`Client feedback comments (${feedbackItems.length})`}>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-4 py-3 sm:px-5">Ticket</th>
                <th className="px-4 py-3 sm:px-5">Client</th>
                <th className="px-4 py-3 sm:px-5">Comment</th>
                <th className="px-4 py-3 sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows cols={4} />
              ) : feedbackItems.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      title="No feedback yet"
                      description="Client comments appear here after they confirm feedback on a completed service."
                    />
                  </td>
                </tr>
              ) : (
                feedbackItems.map((t) => (
                  <tr key={t._id} className="border-t border-border/70 align-top">
                    <td className="px-4 py-3.5 font-mono text-xs sm:px-5">{t.ticketNumber}</td>
                    <td className="px-4 py-3.5 sm:px-5">{t.creatorName}</td>
                    <td className="max-w-md px-4 py-3.5 sm:px-5">
                      <p className="whitespace-pre-wrap text-sm">
                        {t.feedbackComment?.trim() || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <Link
                        to="/admin/requests/$ticketId"
                        params={{ ticketId: t._id }}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "shadow-sm",
                        )}
                      >
                        View request
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataPanel>
      )}
    </div>
  );
}
