import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  RotateCcw,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import museumHeroUrl from "@/assets/nmp-museum-hero.png";
import { EmptyState, PageLoader, StatusBadge, WorkspacePageHeader } from "@/components/layout/workspace-ui";
import { api } from "@/lib/api/client";
import type { SuperAdminIncoming, SuperAdminInsights } from "@/lib/api/client";
import type { ActivityRecord } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { SUPER_ADMIN_FORMS, SUPER_ADMIN_REPORTS, SUPER_ADMIN_TICKETS } from "@/lib/navigation";
import { timeAgo } from "@/lib/time-ago";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin/dashboard")({
  component: SuperAdminDashboardPage,
});

/** Status palette shared by the bars, donut and legend. */
const TONE = {
  completed: "#2f6b3f",
  inProgress: "#1f6f8b",
  pending: "#d69e2e",
} as const;

const card = "rounded-2xl border border-border/80 bg-card shadow-sm";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/* ───────────────────────── Hero ───────────────────────── */

function HeroStat({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="min-w-[5.5rem] first:border-0 border-l border-white/20 pl-4 first:pl-0">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/70">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs text-white/80">{hint}</p>
    </div>
  );
}

function Hero({
  name,
  insights,
}: {
  name: string;
  insights: SuperAdminInsights;
}) {
  const completed = insights.divisions.reduce((n, d) => n + d.completed, 0);
  const divisions = insights.divisions.filter((d) => d.name !== "Unspecified").length;
  const today = new Date()
    .toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    .replace(",", " ·");

  return (
    <section className="relative min-h-[10.5rem] overflow-hidden rounded-2xl bg-maroon-deep p-5 text-white shadow-[0_14px_34px_-12px_color-mix(in_oklab,var(--maroon-deep)_55%,transparent)] sm:p-6">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${museumHeroUrl})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(100deg,color-mix(in_oklab,var(--maroon-deep)_88%,transparent)_0%,color-mix(in_oklab,var(--maroon-deep)_62%,transparent)_45%,color-mix(in_oklab,var(--maroon-deep)_30%,transparent)_100%)]"
      />

      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/75">
            {today} · Super Admin
          </p>
          <h1 className="mt-1 text-balance font-serif [text-shadow:0_1px_12px_rgb(0_0_0/0.35)] text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting()}, {name}
          </h1>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-white/85">
            Here is how the Support Ticketing System is doing across all sections today.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={SUPER_ADMIN_REPORTS}
              className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-semibold text-maroon-deep transition-colors hover:bg-white/90"
            >
              Open Reports &amp; Analytics
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 rounded-xl bg-black/25 px-5 py-3 ring-1 ring-white/15 backdrop-blur-sm">
          <HeroStat label="All requests" value={insights.total} hint={plural(divisions, "section")} />
          <HeroStat
            label="Completed"
            value={completed}
            hint={`${pct(completed, insights.total)}%`}
          />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Requests by section ───────────────────────── */

type DivisionRow = SuperAdminInsights["divisions"][number];

function DivisionBar({ d }: { d: DivisionRow }) {
  const total = Math.max(1, d.total);
  const seg = (n: number, color: string) => (
    <span style={{ width: `${(n / total) * 100}%`, background: color }} className="h-full" />
  );
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/70">
      <div className="flex h-full">
        {seg(d.completed, TONE.completed)}
        {seg(d.inProgress, TONE.inProgress)}
        {seg(d.pending, TONE.pending)}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {(
        [
          ["Completed", TONE.completed],
          ["In progress", TONE.inProgress],
          ["Pending", TONE.pending],
        ] as const
      ).map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

const DIVISIONS_PER_PAGE = 5;

function DivisionPanel({ insights }: { insights: SuperAdminInsights }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"requests" | "done" | "late">("requests");
  const [status, setStatus] = useState<"all" | "completed" | "inProgress" | "pending">("all");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return insights.divisions
      .filter((d) => (q ? d.name.toLowerCase().includes(q) : true))
      .filter((d) => (status === "all" ? true : d[status] > 0))
      .sort((a, b) =>
        sort === "done"
          ? pct(b.completed, b.total) - pct(a.completed, a.total)
          : sort === "late"
            ? b.overdue - a.overdue
            : b.total - a.total,
      );
  }, [insights.divisions, query, sort, status]);

  const pageCount = Math.max(1, Math.ceil(rows.length / DIVISIONS_PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const visible = rows.slice(current * DIVISIONS_PER_PAGE, (current + 1) * DIVISIONS_PER_PAGE);

  const select =
    "h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/30";

  return (
    <section className={cn(card, "p-4")}>
      <h2 className="text-lg font-semibold text-foreground">Requests by section</h2>
      <p className="text-xs text-muted-foreground">
        {plural(insights.divisions.length, "section")} · {plural(insights.total, "request")}
      </p>

      <div className="mt-3 flex gap-2">
        <label className="relative min-w-[8rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search section…"
            className={cn(select, "w-full pl-8")}
          />
        </label>
        <select value={sort} onChange={(e) => {
            setSort(e.target.value as typeof sort);
            setPage(0);
          }} className={select}>
          <option value="requests">Sort: Most requests</option>
          <option value="done">Sort: Highest % done</option>
          <option value="late">Sort: Most overdue</option>
        </select>
        <select value={status} onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(0);
          }} className={select}>
          <option value="all">All statuses</option>
          <option value="completed">Has completed</option>
          <option value="inProgress">Has in progress</option>
          <option value="pending">Has pending</option>
        </select>
      </div>

      <div className="mt-3">
        <Legend />
      </div>

      <ol className="mt-2 divide-y divide-border/60">
        {visible.map((d, i) => (
          <li key={d.name} className="grid grid-cols-[1.25rem_minmax(0,1fr)_7rem_auto] h-14 items-center gap-3">
            <span className="text-xs text-muted-foreground">{current * DIVISIONS_PER_PAGE + i + 1}</span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-xs font-semibold capitalize leading-snug text-foreground" title={d.name}>{d.name.toLowerCase()}</p>
              <p className="truncate text-[0.68rem] text-muted-foreground">
                {plural(d.total, "request")} · {pct(d.completed, d.total)}% done
              </p>
            </div>
            <DivisionBar d={d} />
            <span
              className={cn(
                "w-14 rounded-full px-1.5 py-0.5 text-center text-[0.65rem] font-semibold",
                d.overdue > 0 ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground",
              )}
            >
              {d.overdue} late
            </span>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">No sections match.</li>
        ) : null}
      </ol>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {rows.length === 0
            ? "No sections"
            : `${current * DIVISIONS_PER_PAGE + 1}–${Math.min(rows.length, (current + 1) * DIVISIONS_PER_PAGE)} of ${plural(rows.length, "section")}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {current + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount - 1}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-maroon px-2.5 text-xs font-semibold text-white transition-colors hover:bg-maroon-deep disabled:pointer-events-none disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Needs attention ───────────────────────── */

function NeedsAttention({ insights }: { insights: SuperAdminInsights }) {
  const top = insights.divisions
    .filter((d) => d.overdue > 0)
    .map((d) => ({ ...d, rate: d.overdue / Math.max(1, d.total) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  return (
    <section className={cn(card, "flex flex-col p-4")}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold leading-tight text-foreground">Needs attention</h2>
          <p className="text-xs text-muted-foreground">Top 5 sections by overdue rate</p>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="my-4 flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <BadgeCheck className="h-4 w-4 text-emerald-600" /> Nothing overdue
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {top.map((d) => (
            <li key={d.name}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground">{d.name}</span>
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[0.7rem] font-semibold text-red-700">
                  {d.overdue} overdue
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/70">
                <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(6, d.rate * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        to={SUPER_ADMIN_TICKETS}
        search={{ tab: "overdue" }}
        className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-maroon hover:underline"
      >
        See all overdue by section <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

/* ───────────────────────── Alert cards + status strip ───────────────────────── */

function AlertCard({
  label,
  value,
  hint,
  action,
  icon: Icon,
  tone,
  children,
}: {
  label: string;
  value: number;
  hint: string;
  action: string;
  icon: LucideIcon;
  tone: "red" | "amber" | "slate";
  children: (props: { className: string; children: React.ReactNode }) => React.ReactElement;
}) {
  const palette = {
    red: { box: "border-red-200 bg-red-50/60", chip: "bg-red-100 text-red-700", link: "text-red-700" },
    amber: { box: "border-amber-200 bg-amber-50/60", chip: "bg-amber-100 text-amber-700", link: "text-amber-700" },
    slate: { box: "border-sky-200 bg-sky-50/60", chip: "bg-sky-100 text-sky-700", link: "text-sky-700" },
  }[tone];
  return children({
    className: cn(
      "group flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
      palette.box,
    ),
    children: (
      <>
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", palette.chip)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums leading-tight text-foreground">{value}</span>
            <span className="truncate text-xs text-muted-foreground">{hint}</span>
          </p>
        </div>
        <span className={cn("shrink-0 text-xs font-semibold group-hover:underline", palette.link)}>{action} ›</span>
      </>
    ),
  });
}

function StatusStrip({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <section className={cn(card, "grid grid-cols-2 divide-border/70 sm:grid-cols-5 sm:divide-x")}>
      {items.map((i) => (
        <div key={i.label} className="px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
            {i.label}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-foreground">{i.value}</p>
        </div>
      ))}
    </section>
  );
}

/* ───────────────────────── Incoming tickets ───────────────────────── */

type IncomingTab = "all" | "new" | "assigned" | "overdue";

function IncomingTickets({ incoming }: { incoming: SuperAdminIncoming }) {
  const [tab, setTab] = useState<IncomingTab>("all");
  const rows = incoming.items.slice(0, 5).filter((t) =>
    tab === "all"
      ? true
      : tab === "new"
        ? ["pending_approval", "for_client_approval", "for_process_owner", "pending", "open"].includes(t.status)
        : tab === "assigned"
          ? t.assignees.length > 0
          : t.overdueDays > 0,
  );
  const tabs: { key: IncomingTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "assigned", label: "Assigned" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <section className={cn(card, "flex flex-col p-4")}>
      <h2 className="text-lg font-semibold text-foreground">Incoming tickets</h2>
      <p className="text-xs text-muted-foreground">Newest first</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
              tab === t.key ? "border-maroon bg-maroon text-white" : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {t.label}
            {incoming.counts[t.key] > 0 ? <span className="tabular-nums">{incoming.counts[t.key]}</span> : null}
          </button>
        ))}
      </div>

      <ul className="mt-2 divide-y divide-border/60">
        {rows.map((t) => (
          <li key={t._id} className="flex items-start gap-3 py-2">
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", t.assignees.length ? "bg-muted-foreground/40" : "bg-sky-600")}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{t.formTitle}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t.ticketNumber}
                {t.section ? ` · ${t.section}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={t.overdueDays > 0 ? "overdue" : t.status} label={t.overdueDays > 0 ? "Overdue" : undefined} />
              <span className="text-xs text-muted-foreground">{timeAgo(t.createdAt)}</span>
            </div>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="py-10 text-center text-sm text-muted-foreground">No tickets in this view.</li>
        ) : null}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <p className="text-xs text-muted-foreground">
          Latest {Math.min(5, incoming.items.length)} · {incoming.counts.all} today
        </p>
        <Link
          to={SUPER_ADMIN_TICKETS}
          className="inline-flex h-9 items-center rounded-lg bg-maroon px-4 text-sm font-semibold text-white transition-colors hover:bg-maroon-deep"
        >
          View all tickets ›
        </Link>
      </div>
    </section>
  );
}

/* ───────────────────────── Recent activity ───────────────────────── */

function RecentActivity({ items }: { items: ActivityRecord[] }) {
  return (
    <section className={cn(card, "flex flex-col p-4")}>
      <h2 className="text-base font-semibold leading-tight text-foreground">Recent activity</h2>
      <p className="text-xs text-muted-foreground">Latest actions in the system</p>
      <ul className="mt-3 space-y-3">
        {items.slice(0, 5).map((a) => (
          <li key={a._id} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{a.summary}</p>
              <p className="truncate text-xs text-muted-foreground">{a.actorName}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
          </li>
        ))}
        {items.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">No activity yet.</li> : null}
      </ul>
    </section>
  );
}

/* ───────────────────────── Page ───────────────────────── */

function SuperAdminDashboardPage() {
  const { user } = useAuth();
  const { canQuery } = useAdminSession();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["super-admin-overview"],
    queryFn: () => api.superAdminOverview(),
    enabled: canQuery,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <PageLoader label="Loading system overview…" />;
  }

  if (isError || !data) {
    return (
      <div className="page-shell">
        <WorkspacePageHeader title="Dashboard" description="Overall status of the Support Ticketing System." />
        <EmptyState
          title="Could not load overview"
          description={error instanceof Error ? error.message : "Try again later."}
        />
      </div>
    );
  }

  const { forms, tickets, insights, incoming, recentActivities } = data;
  const pending = insights.divisions.reduce((n, d) => n + d.pending, 0);
  const overdueSections = insights.divisions.filter((d) => d.overdue > 0).length;
  const name = user?.name?.trim() || "Super Admin";

  return (
    <div className="page-shell !gap-3">
      <Hero name={name} insights={insights} />

      <section className="grid gap-3 md:grid-cols-3">
        <AlertCard
          label="Overdue tickets"
          value={insights.overdue}
          hint={`across ${plural(overdueSections, "section")}`}
          action="Review"
          icon={AlertTriangle}
          tone="red"
        >
          {(p) => <Link to={SUPER_ADMIN_TICKETS} search={{ tab: "overdue" }} {...p} />}
        </AlertCard>
        <AlertCard
          label="Forms to review"
          value={forms.pendingReview}
          hint="waiting for Records"
          action="Open"
          icon={FileText}
          tone="amber"
        >
          {(p) => <Link to={SUPER_ADMIN_FORMS} {...p} />}
        </AlertCard>
        <AlertCard
          label="Reopened"
          value={tickets.reopened}
          hint="needs another look"
          action="View"
          icon={RotateCcw}
          tone="slate"
        >
          {(p) => <Link to={SUPER_ADMIN_TICKETS} search={{ tab: "reopened" }} {...p} />}
        </AlertCard>
      </section>

      <StatusStrip
        items={[
          { label: "Pending", value: pending, color: TONE.pending },
          { label: "In progress", value: tickets.inProgress, color: TONE.inProgress },
          { label: "Resolved", value: tickets.resolved, color: TONE.completed },
          { label: "Closed", value: tickets.closed, color: "#64748b" },
          { label: "Rejected", value: tickets.rejected, color: "#c0392b" },
        ]}
      />

      <section className="grid gap-3 lg:grid-cols-2">
        <DivisionPanel insights={insights} />
        <IncomingTickets incoming={incoming} />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <NeedsAttention insights={insights} />
        <RecentActivity items={recentActivities} />
      </section>
    </div>
  );
}
