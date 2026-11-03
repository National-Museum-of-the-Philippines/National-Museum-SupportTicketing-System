import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { PageLoader } from "@/components/layout/workspace-ui";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { FormReport, FormReportClosedTicket, FormReportGroup } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { hasFullReport, isRenielleAccount } from "@/lib/resty";
import { formatTicketStatus } from "@/lib/ticket-status";
import { cn } from "@/lib/utils";

const COLORS = ["#7a1f2b", "#1f7a6b", "#e3a33b", "#3e5ba9", "#8a6f7a", "#c2527a"];
const GREEN = "#1f5a3a";

const DEFAULT_REQUEST_TYPES = [
  "Website Update",
  "Information System",
  "Event Assistance",
  "Network/Hardware Troubleshooting",
  "Software Troubleshooting",
  "Others",
];

/** On the TARF, the "Type" group always shows the six request types in this order, even with no requests yet. */
function withDefaultTypes(groups: FormReportGroup[], isTarf: boolean): FormReportGroup[] {
  if (!isTarf) return groups;
  const isType = (g: FormReportGroup) => /^type\b/i.test(g.label.trim());
  const typeGroup = groups.find(isType);
  const counts = new Map((typeGroup?.options ?? []).map((o) => [o.label.trim().toLowerCase(), o.requests]));
  const raw = DEFAULT_REQUEST_TYPES.map((name) => ({ name, requests: counts.get(name.toLowerCase()) ?? 0 }));
  const total = raw.reduce((n, o) => n + o.requests, 0);
  const merged: FormReportGroup = {
    fieldId: typeGroup?.fieldId ?? "",
    label: "Type",
    totalTicks: total,
    requestsAnswered: typeGroup?.requestsAnswered ?? 0,
    options: raw.map((o) => ({
      optionId: o.name,
      label: o.name,
      requests: o.requests,
      percent: total > 0 ? Math.round((o.requests / total) * 100) : 0,
    })),
    hasLegacy: false,
  };
  return [merged, ...groups.filter((g) => !isType(g))];
}

/** Fields the builder leaves with the same label (its default is "Type") get a number, so every chart has its own title. */
function uniqueLabels(groups: FormReportGroup[]): FormReportGroup[] {
  const total = new Map<string, number>();
  for (const g of groups) total.set(g.label.trim(), (total.get(g.label.trim()) ?? 0) + 1);
  const seen = new Map<string, number>();
  return groups.map((g) => {
    const key = g.label.trim();
    if ((total.get(key) ?? 0) < 2) return g;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return { ...g, label: `${key} ${n}` };
  });
}

/** The donuts for a single closed ticket: only the options that ticket ticked count. */
function groupsForTicket(groups: FormReportGroup[], ticket: FormReportClosedTicket): FormReportGroup[] {
  return groups.map((g) => {
    const picked = new Set((ticket.choices[g.fieldId] ?? []).map((v) => v.trim().toLowerCase()));
    const options = g.options.map((o) => ({ ...o, requests: picked.has(o.label.trim().toLowerCase()) ? 1 : 0 }));
    const totalTicks = options.reduce((n, o) => n + o.requests, 0);
    return {
      ...g,
      options: options.map((o) => ({ ...o, percent: totalTicks > 0 ? Math.round((o.requests / totalTicks) * 100) : 0 })),
      totalTicks,
      requestsAnswered: totalTicks > 0 ? 1 : 0,
      hasLegacy: false,
    };
  });
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (iso: string, withYear = false) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });

type Period = string;

/** This year and the three before it, as `y:YYYY` options. */
function yearOptions() {
  const y = new Date().getFullYear();
  return [0, 1, 2, 3].map((i) => ({ value: `y:${y - i}`, label: `Year ${y - i}` }));
}

function rangeFor(period: Period) {
  const now = new Date();
  const to = ymd(now);
  const back = (days: number) => ymd(new Date(now.getTime() - days * 86_400_000));
  if (period.startsWith("y:")) {
    const y = Number(period.slice(2));
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  if (period.startsWith("m:")) {
    const [y, m] = period.slice(2).split("-").map(Number);
    return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  }
  switch (period) {
    case "30d":
      return { from: back(29), to };
    case "3m":
      return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to };
    case "year":
      return { from: `${now.getFullYear()}-01-01`, to };
    case "all":
      return { from: "2000-01-01", to };
    default:
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
}

const card = "rounded-2xl border border-border/80 bg-card shadow-sm";
const btn =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/50 focus-visible:ring-offset-2";

function Kpi({ label, value, note, tone, dense }: { label: string; value: ReactNode; note?: string; tone?: "good" | "bad" | "muted"; dense?: boolean }) {
  return (
    <div className={cn(card, dense ? "px-4 py-3" : "px-5 py-4")}>
      <p className={cn("text-muted-foreground", dense ? "text-xs" : "text-sm")}>{label}</p>
      <p className={cn("mt-1 font-bold tabular-nums text-foreground", dense ? "text-2xl" : "text-3xl")}>{value}</p>
      {note ? (
        <p className={cn("mt-1 text-xs font-semibold", tone === "good" && "text-emerald-800", tone === "bad" && "text-maroon", tone === "muted" && "text-muted-foreground")}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

function BarList({ rows, empty }: { rows: Array<{ name: string; count: number }>; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="mt-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-foreground/85" title={r.name}>{r.name}</span>
            <span className="shrink-0 font-bold tabular-nums">{r.count}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-maroon" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TypeDonut({ group, onPick, active, small }: { group: FormReportGroup; onPick: (label: string) => void; active: string | null; small: boolean }) {
  const total = group.totalTicks;
  const r = 52;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = group.options.map((o, i) => ({ ...o, color: o.optionId === "__other" ? "#7b8794" : COLORS[i % COLORS.length] }));
  const top = [...group.options].filter((o) => o.optionId !== "__other").sort((a, b) => b.requests - a.requests)[0];

  return (
    <article className={cn(card, small ? "p-5" : "p-6")}>
      <h3 className={cn("font-bold", small ? "text-sm" : "text-base")}>{group.label === "Type" ? "Type of request" : group.label}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {group.label === "Type"
          ? "Number of requests per type. Counted when the client closes the ticket."
          : `${group.hint ? `${group.hint}, ` : ""}${group.options.length} options${small && top && top.requests > 0 ? ` · top: ${top.label}` : ""}`}
      </p>
      <div className={cn("flex flex-wrap items-center gap-y-4", small ? "mt-3 gap-x-5" : "mt-5 gap-x-6")}>
        <div className={cn("relative shrink-0", small ? "h-24 w-24" : "h-36 w-36")}>
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`${total} ticks`}>
            <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="26" className="text-muted/70" />
            {total > 0
              ? slices.filter((s) => s.requests > 0).map((s) => {
                  const len = (s.requests / total) * circ;
                  const el = (
                    <circle key={s.optionId} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="26"
                      strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${circ}`} strokeDashoffset={-offset}>
                      <title>{`${s.label}: ${s.requests}`}</title>
                    </circle>
                  );
                  offset += len;
                  return el;
                })
              : null}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-bold leading-none tabular-nums", small ? "text-xl" : "text-3xl")}>{total}</span>
            <span className="mt-1 text-[0.65rem] text-muted-foreground">ticks</span>
          </div>
        </div>
        <ul className={cn("min-w-[12rem] flex-1", small ? "space-y-0" : "space-y-1")}>
          {slices.map((s) => (
            <li key={s.optionId}>
              <button
                type="button"
                disabled={s.optionId === "__other"}
                onClick={() => onPick(s.label)}
                aria-pressed={active === s.label}
                title="Show requests that ticked this option"
                className={cn(
                  "flex w-full items-center rounded-md text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 disabled:cursor-default disabled:hover:bg-transparent",
                  small ? "min-h-[26px] gap-2.5 px-2 py-0.5" : "min-h-[32px] gap-3 px-2 py-1",
                  active === s.label && "bg-maroon/10",
                )}
              >
                <span className={cn("shrink-0 rounded-full", small ? "h-2.5 w-2.5" : "h-3 w-3")} style={{ background: s.color }} aria-hidden />
                <span className={cn("min-w-0 flex-1", small ? "text-xs" : "text-sm")}>{s.label}</span>
                <span className={cn("shrink-0 tabular-nums", small ? "text-xs" : "text-sm")}>
                  <strong>{s.requests}</strong>
                  <span className="text-muted-foreground"> · {s.percent}%</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {small ? null : (
        <div className="mt-5 rounded-lg bg-maroon/10 px-4 py-2.5 text-xs">
          {top && top.requests > 0 ? (
            <>Most requested: <strong>{top.label}</strong> ({top.requests} request{top.requests === 1 ? "" : "s"})</>
          ) : (
            "No requests in this period."
          )}
        </div>
      )}
    </article>
  );
}

/** A section of choice fields (e.g. one column per museum) drawn as one card of bar rows. */
function SectionBars({ title, hint, groups, onPick, active }: {
  title: string;
  hint?: string;
  groups: FormReportGroup[];
  onPick: (fieldId: string, label: string) => void;
  active: { fieldId: string; option: string } | null;
}) {
  const optionCount = groups.reduce((n, g) => n + g.options.length, 0);
  return (
    <section className={cn(card, "p-5")}>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {hint ? `${hint}. ` : ""}One column for each group, {optionCount} options in total
      </p>
      <div className={cn("mt-4 grid gap-x-8 gap-y-6", groups.length > 1 && "md:grid-cols-2", groups.length > 2 && "xl:grid-cols-3")}>
        {groups.map((g) => {
          const max = Math.max(1, ...g.options.map((o) => o.requests));
          return (
            <div key={g.fieldId}>
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-xs font-bold">{g.label}</h4>
                <span className="shrink-0 text-[0.7rem] text-muted-foreground">{g.totalTicks} ticks</span>
              </div>
              <ul className="mt-2 space-y-2.5">
                {g.options.map((o, i) => (
                  <li key={o.optionId}>
                    <button
                      type="button"
                      disabled={o.optionId === "__other"}
                      onClick={() => onPick(g.fieldId, o.label)}
                      aria-pressed={active?.fieldId === g.fieldId && active.option === o.label}
                      title="Show requests that ticked this option"
                      className="block w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 disabled:cursor-default"
                    >
                      <span className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate" title={o.label}>{o.label}</span>
                        <span className="shrink-0 font-bold tabular-nums">{o.requests}</span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full" style={{ width: `${(o.requests / max) * 100}%`, background: o.optionId === "__other" ? "#7b8794" : COLORS[i % COLORS.length] }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Dropdown of every closed ticket of the form; picking one shows what the client filled in. */
function ClosedTicketPicker({ items, isLoading, isError, ticketId, onChange }: {
  items: FormReportClosedTicket[];
  isLoading: boolean;
  isError: boolean;
  ticketId: string;
  onChange: (id: string) => void;
}) {
  const current = items.find((t) => t._id === ticketId) ?? null;
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—");

  return (
    <section className={cn(card, "p-5")}>
      <h3 className="text-sm font-bold">Closed tickets</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A request appears here once the client has closed it. Pick one to see what was filled in.
      </p>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="closed-ticket">
          {isLoading ? "Loading…" : `${items.length} closed ticket${items.length === 1 ? "" : "s"}`}
        </label>
        <select id="closed-ticket" value={ticketId} onChange={(e) => onChange(e.target.value)} disabled={items.length === 0}
          className="min-h-[44px] w-full max-w-xl rounded-lg border border-border bg-card px-3 text-sm shadow-sm disabled:opacity-60">
          <option value="">{items.length === 0 ? "No closed tickets in this period" : "Select a closed ticket"}</option>
          {items.map((t) => (
            <option key={t._id} value={t._id}>{t.ticketNumber} · {t.creatorName} · closed {day(t.closedAt)}</option>
          ))}
        </select>
        {isError ? <p className="mt-2 text-xs text-destructive">Could not load closed tickets.</p> : null}
      </div>

      {current ? (
        <div className="mt-4 rounded-xl border border-border/70 bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs font-bold">{current.ticketNumber}</p>
              <p className="text-sm font-semibold">{current.title}</p>
              <p className="text-xs text-muted-foreground">{current.creatorName}{current.division ? ` · ${current.division}` : ""}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Submitted {day(current.createdAt)}</p>
              <p>Closed {day(current.closedAt)}</p>
              <Link to="/admin/requests/$ticketId" params={{ ticketId: current._id }} className="mt-1 inline-block font-semibold text-maroon hover:underline">View request</Link>
            </div>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {current.answers.map((a, i) => (
              <div key={`${a.label}-${i}`} className="min-w-0">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{a.label}</dt>
                <dd className="mt-0.5 break-words text-sm">
                  {a.value === "" ? <span className="text-muted-foreground">—</span> : a.type === "file" ? (
                    <a href={a.value} target="_blank" rel="noreferrer" className="font-semibold text-maroon hover:underline">Open file</a>
                  ) : a.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

/** Staff table with search, sort and a top-5 cut-off. */
function PersonnelCompact({ personnel }: { personnel: FormReport["personnel"] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"assigned" | "closed" | "name">("assigned");
  const [all, setAll] = useState(false);
  const rows = [...personnel.rows, ...(personnel.unassigned ? [{ userId: "none", name: "Not yet assigned", ...personnel.unassigned, percentClosed: 0 }] : [])]
    .filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort]));
  const shown = all ? rows : rows.slice(0, 5);
  const staffCount = personnel.rows.length;

  return (
    <section className={cn(card, "overflow-hidden")}>
      <div className="p-5 pb-3">
        <h3 className="text-sm font-bold">Assigned personnel</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Requests assigned to each staff in charge</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff" aria-label="Search staff" className="min-h-[40px] min-w-[10rem] flex-1" />
          <select aria-label="Sort staff" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
            className="min-h-[40px] rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm">
            <option value="assigned">Sort: Most assigned</option>
            <option value="closed">Sort: Most closed</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border/70 text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-2.5 font-semibold">Staff in charge</th>
            <th className="px-2 py-2.5 text-right font-semibold">Assigned</th>
            <th className="px-2 py-2.5 text-right font-semibold">Closed</th>
            <th className="px-5 py-2.5 text-right font-semibold">Open</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.userId} className="border-b border-border/60">
              <td className="px-5 py-3">
                <p className="text-xs font-semibold">{p.name}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${p.percentClosed}%`, background: GREEN }} />
                </div>
              </td>
              <td className="px-2 py-3 text-right tabular-nums">{p.assigned}</td>
              <td className="px-2 py-3 text-right font-bold tabular-nums" style={{ color: GREEN }}>{p.closed}</td>
              <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{p.open}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">{q ? "No staff match your search." : "No requests in this period."}</td></tr>
          ) : null}
          <tr className="font-bold">
            <td className="px-5 py-3 text-xs">Total ({staffCount === 1 ? "1 staff" : `all ${staffCount} staff`})</td>
            <td className="px-2 py-3 text-right tabular-nums">{personnel.total.assigned}</td>
            <td className="px-2 py-3 text-right tabular-nums" style={{ color: GREEN }}>{personnel.total.closed}</td>
            <td className="px-5 py-3 text-right tabular-nums">{personnel.total.open}</td>
          </tr>
        </tbody>
      </table>
      {rows.length > 5 || all ? (
        <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-1 text-xs text-muted-foreground">
          <span>{all ? `All ${rows.length} staff` : `Top 5 of ${rows.length} staff`}</span>
          <button type="button" onClick={() => setAll((v) => !v)}
            className="min-h-[40px] rounded-lg border border-border bg-card px-4 text-sm font-semibold text-maroon hover:bg-muted">
            {all ? "Show top 5" : `View all ${rows.length} staff`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

type Status = "all" | "open" | "closed" | "rejected";

function RequestsList({ formId, range, status, setStatus, optionFilter, onClearOption }: {
  formId: string;
  range: { from: string; to: string };
  status: Status;
  setStatus: (s: Status) => void;
  optionFilter: { fieldId: string; option: string } | null;
  onClearOption: () => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, q, optionFilter, formId, range.from, range.to]);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["form-report-requests", formId, range, status, q, optionFilter, page],
    queryFn: () => api.formReportRequests(formId, { ...range, status, q, page: String(page), ...(optionFilter ?? {}) }, "admin"),
    placeholderData: (prev) => prev,
  });
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (data?.pageSize ?? 10)));

  return (
    <section id="requests" className={cn(card, "p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold">Requests ({total})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Filter by status">
            {(["all", "open", "closed", "rejected"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
                className={cn("min-h-[40px] px-4 text-sm font-semibold capitalize", status === s ? "bg-maroon text-white" : "bg-card hover:bg-muted")}>
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests" aria-label="Search requests" className="h-10 w-52 pl-8" />
          </div>
        </div>
      </div>
      {optionFilter ? (
        <button type="button" onClick={onClearOption} className="mt-3 rounded-full bg-maroon/10 px-3 py-1 text-xs font-semibold text-maroon">
          Ticked: {optionFilter.option} ✕
        </button>
      ) : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5 font-semibold">Ticket</th>
              <th className="px-3 py-2.5 font-semibold">Client</th>
              <th className="px-3 py-2.5 font-semibold">Division / Section</th>
              <th className="px-3 py-2.5 font-semibold">Submitted</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 text-right font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Loading requests…</td></tr>
            ) : isError ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-destructive">Could not load requests.</td></tr>
            ) : (data?.items.length ?? 0) === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No requests yet for this form.</td></tr>
            ) : (
              data!.items.map((t) => (
                <tr key={t._id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-3.5 font-mono text-xs">{t.ticketNumber}</td>
                  <td className="px-3 py-3.5">{t.creatorName}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">{t.division || "—"}</td>
                  <td className="px-3 py-3.5">{new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-3 py-3.5 capitalize">{formatTicketStatus(t.status)}</td>
                  <td className="px-3 py-3.5 text-right">
                    <Link to="/admin/requests/$ticketId" params={{ ticketId: t._id }}
                      className="inline-flex min-h-[40px] items-center rounded-lg bg-maroon/10 px-4 text-xs font-semibold text-maroon hover:bg-maroon/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40">
                      View request
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {Math.min(page, pages)} of {pages}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="min-h-[40px] rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">Previous</button>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="min-h-[40px] rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">Next</button>
        </div>
      </div>
    </section>
  );
}

function MonthlySection({
  perMonth,
  targetDays,
  monthKey,
  onMonthChange,
  compact = false,
}: {
  perMonth: FormReport["perMonth"];
  targetDays: number;
  monthKey: string;
  onMonthChange: (month: string) => void;
  compact?: boolean;
}) {
  const year = perMonth[0]?.month.slice(0, 4);
  const [showTable, setShowTable] = useState(false);
  const tableVisible = !compact || showTable || monthKey !== "all";
  const max = Math.max(1, ...perMonth.map((m) => m.requests));
  const name = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: "long" });
  const sum = (key: "requests" | "closed" | "open" | "withinTarget") => perMonth.reduce((n, m) => n + m[key], 0);
  const allDays = perMonth.flatMap((m) => (m.avgDays != null ? Array(m.closed).fill(m.avgDays) : []));
  const totalAvg = allDays.length ? Math.round((allDays.reduce((a, b) => a + b, 0) / allDays.length) * 10) / 10 : null;
  const month = perMonth.find((m) => m.month === monthKey);
  const daily = month?.daily ?? [];

  return (
    <section className={cn(card, "overflow-hidden")}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-6 pb-2">
        <div>
          <h3 className="text-base font-bold">Requests per month, {year}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Pick a month at the top of the page, or click a bar, to see its days.</p>
        </div>
        {compact ? null : (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: GREEN }} />Closed</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Open</span>
          </div>
        )}
      </div>

      <div className={cn("flex items-end gap-2 px-6 pb-2 pt-4 sm:gap-4", compact ? "h-44" : "h-56")}>
        {perMonth.map((m) => {
          const h = (m.requests / max) * 100;
          return (
            <button
              type="button"
              key={m.month}
              onClick={() => onMonthChange(monthKey === m.month ? "all" : m.month)}
              aria-pressed={monthKey === m.month}
              className={cn("flex h-full flex-1 flex-col justify-end rounded-md text-center", monthKey === m.month && "bg-maroon/5")}
            >
              <p className="mb-1 text-sm font-bold tabular-nums">{m.requests > 0 ? m.requests : ""}</p>
              {m.requests > 0 ? (
                <div className="flex flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${h}%` }}>
                  <div className="bg-amber-500" style={{ flex: m.open }} />
                  <div style={{ flex: m.closed, background: GREEN }} />
                </div>
              ) : (
                <div className="h-1 rounded bg-muted" />
              )}
              <p className="mt-2 text-xs text-muted-foreground">{name(m.month).slice(0, 3)}</p>
            </button>
          );
        })}
      </div>

      {compact ? (
        <div className="flex items-center justify-between gap-3 px-6 pb-4 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: GREEN }} />Closed</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Open</span>
          </div>
          {monthKey === "all" ? (
            <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}
              className="text-sm font-semibold text-maroon underline underline-offset-2">
              {showTable ? "Hide month table" : "Show month table"}
            </button>
          ) : null}
        </div>
      ) : null}

      {tableVisible ? (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-y border-border/70 bg-muted/40 text-left text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 font-semibold">{month ? "Day" : "Month"}</th>
              <th className="px-2 py-3 font-semibold">Requests</th>
              <th className="px-2 py-3 font-semibold">Closed</th>
              <th className="px-2 py-3 font-semibold">Open</th>
              <th className="px-2 py-3 font-semibold">Avg days to close</th>
              <th className="px-2 py-3 font-semibold">Within target</th>
            </tr>
          </thead>
          <tbody>
            {month ? (
              daily.length === 0 ? (
                <tr className="border-b border-border/60 text-muted-foreground">
                  <td colSpan={6} className="px-6 py-3">No requests in {name(month.month)} {year}.</td>
                </tr>
              ) : (
                daily.map((d) => (
                  <tr key={d.day} className="border-b border-border/60">
                    <td className="px-6 py-3 font-bold">{name(month.month)} {d.day}</td>
                    <td className="px-2 py-3 tabular-nums">{d.requests}</td>
                    <td className="px-2 py-3 font-bold tabular-nums" style={{ color: GREEN }}>{d.closed}</td>
                    <td className="px-2 py-3 tabular-nums text-amber-700">{d.open}</td>
                    <td className="px-2 py-3 tabular-nums">{d.avgDays != null ? `${d.avgDays} days` : "—"}</td>
                    <td className="px-2 py-3">{d.closed > 0 ? `${d.withinTarget} of ${d.closed} on time` : "—"}</td>
                  </tr>
                ))
              )
            ) : null}
            <tr className="bg-muted/40 font-bold">
              <td className="px-6 py-3">{month ? `Total ${name(month.month)} ${year}` : `Total ${year}`}</td>
              <td className="px-2 py-3 tabular-nums">{month ? month.requests : sum("requests")}</td>
              <td className="px-2 py-3 tabular-nums" style={{ color: GREEN }}>{month ? month.closed : sum("closed")}</td>
              <td className="px-2 py-3 tabular-nums text-amber-700">{month ? month.open : sum("open")}</td>
              <td className="px-2 py-3 tabular-nums">{(month ? month.avgDays : totalAvg) != null ? `${month ? month.avgDays : totalAvg} days` : "—"}</td>
              <td className="px-2 py-3">
                {(month ? month.closed : sum("closed")) > 0
                  ? `${month ? month.withinTarget : sum("withinTarget")} of ${month ? month.closed : sum("closed")} on time (target ${targetDays} days)`
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      ) : null}
    </section>
  );
}

export function FormInsightReport() {
  const { user } = useAuth();
  const full = hasFullReport(user);
  const lean = isRenielleAccount(user);
  const [period, setPeriod] = useState<Period>(`y:${new Date().getFullYear()}`);
  const [formId, setFormId] = useState("");
  const range = useMemo(() => rangeFor(period), [period]);
  const year = range.from.slice(0, 4);
  const monthKey = period.startsWith("m:") ? period.slice(2) : "all";
  const changeYear = (y: string) => setPeriod(monthKey === "all" ? `y:${y}` : `m:${y}-${monthKey.slice(5)}`);
  const changeMonth = (m: string) => setPeriod(m === "all" ? `y:${year}` : `m:${m}`);
  const [showList, setShowList] = useState(false);
  const [status, setStatus] = useState<Status>("all");
  const [optionFilter, setOptionFilter] = useState<{ fieldId: string; option: string } | null>(null);

  const { data: formsData, isLoading: formsLoading, isError: formsError } = useQuery({
    queryKey: ["form-report-forms"],
    queryFn: () => api.formReportForms("admin"),
  });
  const forms = formsData?.items ?? [];
  const selected = forms.find((f) => f._id === formId) ?? forms[0];

  useEffect(() => {
    setShowList(false);
    setOptionFilter(null);
    setStatus("all");
  }, [selected?._id]);

  const { data: report, isLoading, isError } = useQuery<FormReport>({
    queryKey: ["form-report", selected?._id, range, full],
    queryFn: () => api.formReport(selected!._id, range, "admin", !full),
    enabled: Boolean(selected),
  });

  const openList = (s: Status) => {
    setStatus(s);
    setShowList(true);
    setTimeout(() => document.getElementById("requests")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const allRequests = async () => {
    const rows: string[][] = [];
    for (let page = 1; page < 100; page++) {
      const res = await api.formReportRequests(selected!._id, { ...range, page: String(page) }, "admin");
      rows.push(...res.items.map((t) => [t.ticketNumber, t.creatorName, t.division, t.createdAt, t.status]));
      if (page * res.pageSize >= res.total) break;
    }
    return rows;
  };

  const exportExcel = async () => {
    if (!report || !selected) return;
    const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const row = (cells: Array<string | number>) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
    const k = report.kpis;
    const html = `<table>
      ${row([selected.title, selected.formNo, `${report.range.from} to ${report.range.to}`])}
      ${row(["Total requests", k.requests, "Closed", k.closed, "Open", k.open, "Rejected", k.rejected])}
      ${row([])}
      ${report.groups.flatMap((g) => g.options.map((o) => row([g.label, o.label, o.requests, `${o.percent}%`]))).join("")}
      ${row([])}
      ${row(["Person in charge", "Assigned", "Closed", "Open"])}
      ${report.personnel.rows.map((p) => row([p.name, p.assigned, p.closed, p.open])).join("")}
      ${row([])}
      ${row(["Ticket", "Client", "Division", "Submitted", "Status"])}
      ${(await allRequests()).map(row).join("")}
    </table>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.formNo || "form"}-report-${range.to}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [ticketId, setTicketId] = useState("");
  const closedQuery = useQuery({
    queryKey: ["form-report-closed", selected?._id, range],
    queryFn: () => api.formReportClosed(selected!._id, range, "admin"),
    enabled: Boolean(selected) && !full,
  });
  const closedItems = closedQuery.data?.items ?? [];
  const pickedTicket = closedItems.find((t) => t._id === ticketId) ?? null;
  useEffect(() => setTicketId(""), [selected?._id, range.from, range.to]);

  const typeGroups = useMemo(
    () => uniqueLabels(withDefaultTypes(report?.groups ?? [], /technical assistan(ce|t)( and)? request form|^tarf$/i.test(selected?.title ?? ""))),
    [report, selected?.title],
  );
  const shownGroups = useMemo(
    () => (pickedTicket ? groupsForTicket(typeGroups, pickedTicket) : typeGroups),
    [typeGroups, pickedTicket],
  );

  /** Consecutive fields of one section are drawn together; fields without a section stay separate donuts. */
  const blocks = useMemo(() => {
    const out: Array<{ section: string; hint: string; groups: FormReportGroup[] }> = [];
    for (const g of shownGroups) {
      const last = out[out.length - 1];
      if (last && last.section === (g.section || "")) last.groups.push(g);
      else out.push({ section: g.section || "", hint: g.sectionHint || "", groups: [g] });
    }
    return out;
  }, [shownGroups]);

  if (formsLoading) return <PageLoader label="Loading forms…" />;
  if (formsError) {
    return (
      <div className="page-shell">
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Could not load your forms. Please refresh the page.</p>
      </div>
    );
  }
  if (!forms.length || !selected) {
    return (
      <div className="page-shell">
        <p className={cn(card, "p-8 text-center text-sm text-muted-foreground")}>No published forms for your office yet.</p>
      </div>
    );
  }

  const k = report?.kpis;
  const office = selected.office || "your office";
  const vs = k?.requestsVsPrevious ?? 0;
  const days = k?.avgDaysVsPrevious;
  const multi = typeGroups.length > 1;
  const pick = (fieldId: string, label: string) => {
    setOptionFilter(optionFilter?.fieldId === fieldId && optionFilter.option === label ? null : { fieldId, option: label });
    openList("closed");
  };

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="form">Form</label>
            <select id="form" value={selected._id} onChange={(e) => setFormId(e.target.value)}
              className="min-h-[44px] min-w-[16rem] rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm">
              {forms.map((f) => (
                <option key={f._id} value={f._id}>{f.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="year">Year</label>
            <select id="year" value={year} onChange={(e) => changeYear(e.target.value)}
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm">
              {yearOptions().map((y) => (
                <option key={y.value} value={y.value.slice(2)}>{y.label}</option>
              ))}
            </select>
          </div>
          {lean ? null : <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="month">Month</label>
            <select id="month" value={monthKey} onChange={(e) => changeMonth(e.target.value)}
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm">
              <option value="all">All months</option>
              {Array.from({ length: 12 }, (_, i) => {
                const key = `${year}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <option key={key} value={key}>
                    {new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: "long" })}
                  </option>
                );
              })}
            </select>
          </div>}
        </div>
        {lean ? null : <button type="button" onClick={() => void exportExcel()} disabled={!report} className={cn(btn, "bg-maroon text-white hover:bg-maroon-deep disabled:opacity-50")}>
          Export
        </button>}
      </div>

      {lean ? null : <p className={cn("rounded-r-lg border-l-4 border-maroon bg-maroon/5 px-4 text-foreground/85", multi ? "py-2.5 text-xs" : "py-3 text-sm")}>
        {multi ? (
          <>Report for <strong>{office}</strong>. Charts are generated from the checkbox groups of this form; one request can tick several options.</>
        ) : (
          <>This report is for <strong>{office}</strong> only. It counts the {typeGroups[0]?.options.length ?? 0} options of the {selected.title} and the closed requests of each staff in charge.</>
        )}
        {report?.hasLegacyAnswers ? <span className="mt-1 block text-xs text-muted-foreground">Some answers use an older version of this form.</span> : null}
      </p>}

      {isError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Could not load this report.</p>
      ) : (
        <>
          {lean ? null : <div className={cn("grid sm:grid-cols-2", full ? "lg:grid-cols-5" : "lg:grid-cols-4", multi ? "gap-3" : "gap-4")}>
            <Kpi dense={multi} label="Total requests" value={isLoading ? "…" : k?.requests ?? 0}
              note={k ? (vs === 0 ? "Same as before" : `${vs > 0 ? "▲" : "▼"} ${Math.abs(vs)} ${vs > 0 ? "more" : "fewer"} than the period before`) : undefined}
              tone={vs > 0 ? "good" : "muted"} />
            <Kpi dense={multi} label="Closed" value={isLoading ? "…" : k?.closed ?? 0} note={k ? `${k.completionRate}% completion rate` : undefined} tone="good" />
            {full ? (
              <Kpi dense={multi} label="Open" value={isLoading ? "…" : k?.open ?? 0}
                note={k ? (k.openPastTarget > 0 ? `${k.openPastTarget} past target` : "None past target") : undefined}
                tone={k && k.openPastTarget > 0 ? "bad" : "muted"} />
            ) : null}
            <Kpi dense={multi} label="Average days to close" value={isLoading ? "…" : k?.avgDaysToClose ?? "—"}
              note={days == null ? undefined : days === 0 ? "Same as before" : `${days < 0 ? "▼" : "▲"} ${Math.abs(days)} days ${days < 0 ? "faster" : "slower"}`}
              tone={days != null && days < 0 ? "good" : days != null && days > 0 ? "bad" : "muted"} />
            <Kpi dense={multi} label="Closed within target" value={isLoading ? "…" : `${k?.closedWithinTarget ?? 0} of ${k?.closed ?? 0}`}
              note={k ? `${k.withinTargetPercent}% on time, target ${k.targetDays} days` : undefined} tone="good" />
          </div>}

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading report…</p>
          ) : report ? (
            <>
              {full ? null : (
                <ClosedTicketPicker items={closedItems} isLoading={closedQuery.isLoading} isError={closedQuery.isError}
                  ticketId={ticketId} onChange={setTicketId} />
              )}

              {pickedTicket ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-maroon/30 bg-maroon/5 px-4 py-2.5 text-sm">
                  <span>Charts show only what <strong>{pickedTicket.ticketNumber}</strong> ticked.</span>
                  <button type="button" onClick={() => setTicketId("")}
                    className="min-h-[36px] rounded-lg border border-border bg-card px-3 text-xs font-semibold text-maroon hover:bg-muted">
                    Show all closed tickets
                  </button>
                </div>
              ) : null}

              {multi ? (
                <>
                  {blocks.map((b, i) =>
                    b.section ? (
                      <SectionBars key={`${b.section}-${i}`} title={b.section} hint={b.hint} groups={b.groups} onPick={pick} active={optionFilter} />
                    ) : (
                      <div key={`plain-${i}`} className="grid items-start gap-4 lg:grid-cols-2">
                        {b.groups.map((g) => (
                          <TypeDonut key={g.fieldId} group={g} small
                            active={optionFilter?.fieldId === g.fieldId ? optionFilter.option : null}
                            onPick={(label) => pick(g.fieldId, label)} />
                        ))}
                      </div>
                    ),
                  )}
                  {lean ? null : <div className={cn("grid items-start gap-4", full && "lg:grid-cols-2")}>
                    <PersonnelCompact personnel={report.personnel} />
                    {full ? <MonthlySection compact perMonth={report.perMonth} targetDays={k?.targetDays ?? 3} monthKey={monthKey} onMonthChange={changeMonth} /> : null}
                  </div>}
                </>
              ) : (
                <>
              <div className={cn("grid items-start gap-4", typeGroups.length <= 1 && "lg:grid-cols-2")}>
                <div className={cn("grid gap-4", typeGroups.length > 1 && "sm:grid-cols-2 xl:grid-cols-3")}>
                  {typeGroups.length === 0 ? (
                    <p className={cn(card, "p-6 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3")}>This form has no checkbox, radio or dropdown fields to chart yet. Add one in the Form Builder and it will show here. The numbers, staff and monthly report below still work.</p>
                  ) : (
                    shownGroups.map((g, i) => (
                      <Fragment key={g.fieldId}>
                      {g.section && g.section !== shownGroups[i - 1]?.section ? (
                        <div className="pt-2 sm:col-span-2 xl:col-span-3">
                          <h3 className="text-base font-bold text-maroon">{g.section}</h3>
                          {g.sectionHint ? <p className="text-xs text-muted-foreground">{g.sectionHint}</p> : null}
                        </div>
                      ) : null}
                      <TypeDonut group={g} small={false}
                        active={optionFilter?.fieldId === g.fieldId ? optionFilter.option : null}
                        onPick={(label) => {
                          setOptionFilter(optionFilter?.fieldId === g.fieldId && optionFilter.option === label ? null : { fieldId: g.fieldId, option: label });
                          openList("closed");
                        }} />
                      </Fragment>
                    ))
                  )}
                </div>

                <section className={cn(card, "overflow-hidden")}>
                  <div className="p-6 pb-4">
                    <h3 className="text-base font-bold">Assigned personnel</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Requests assigned to each staff in charge and how many they closed.</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-border/70 bg-muted/40 text-left text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                        <th className="px-6 py-3 font-semibold">Staff in charge</th>
                        <th className="px-2 py-3 font-semibold">Assigned</th>
                        <th className="px-2 py-3 font-semibold">Closed</th>
                        <th className="px-2 py-3 font-semibold">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...report.personnel.rows, ...(report.personnel.unassigned ? [{ userId: "none", name: "Not yet assigned", ...report.personnel.unassigned, percentClosed: 0 }] : [])].map((p) => (
                        <tr key={p.userId} className="border-b border-border/60 align-top">
                          <td className="px-6 py-4">
                            <p className="font-semibold">{p.name}</p>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${p.percentClosed}%`, background: GREEN }} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{p.percentClosed}% closed</p>
                          </td>
                          <td className="px-2 py-4 tabular-nums">{p.assigned}</td>
                          <td className="px-2 py-4 text-lg font-bold tabular-nums" style={{ color: GREEN }}>{p.closed}</td>
                          <td className="px-2 py-4 tabular-nums">{p.open}</td>
                        </tr>
                      ))}
                      {report.personnel.rows.length === 0 && !report.personnel.unassigned ? (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No requests in this period.</td></tr>
                      ) : null}
                      <tr className="bg-muted/40 font-bold">
                        <td className="px-6 py-3">Total</td>
                        <td className="px-2 py-3 tabular-nums">{report.personnel.total.assigned}</td>
                        <td className="px-2 py-3 tabular-nums" style={{ color: GREEN }}>{report.personnel.total.closed}</td>
                        <td className="px-2 py-3 tabular-nums">{report.personnel.total.open}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              </div>

              {full ? <MonthlySection perMonth={report.perMonth} targetDays={k?.targetDays ?? 3} monthKey={monthKey} onMonthChange={changeMonth} /> : null}
                </>
              )}

                            {full && !lean ? (
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <section className={cn(card, "p-6")}>
                  <h3 className="text-base font-bold">Open requests to follow up</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Oldest first. Target is {k?.targetDays} days.</p>
                  {report.openRequests.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">No open requests. Nothing to follow up.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-border/70">
                      {report.openRequests.map((t) => (
                        <li key={t._id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <Link to="/admin/requests/$ticketId" params={{ ticketId: t._id }} className="font-mono text-xs font-bold hover:underline">{t.ticketNumber}</Link>
                            <p className="truncate text-xs text-emerald-800">{t.assignedTo || "Not yet assigned"}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs">{t.creatorName}</span>
                            <span className={cn("rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold", t.pastTarget ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800")}>
                              {t.daysOpen} day{t.daysOpen === 1 ? "" : "s"} open
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" onClick={() => openList("open")} className={cn(btn, "mt-3 border border-border bg-card text-maroon hover:bg-muted")}>
                    See all open requests
                  </button>
                </section>

                <section className={cn(card, "p-6")}>
                  <h3 className="text-base font-bold">Requests per Division/Section</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Who sends requests to this form</p>
                  <BarList rows={report.byDivision} empty="No requests in this period." />
                </section>
              </div>
              ) : null}
            </>
          ) : null}

          {full && !lean ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => (showList && status === "all" ? setShowList(false) : openList("all"))} aria-expanded={showList}
                className={cn(btn, "bg-maroon text-white hover:bg-maroon-deep")}>
                {showList ? "Hide requests" : `See all ${k?.requests ?? 0} requests`}
              </button>
            </div>
          ) : null}

          {showList ? (
            <RequestsList formId={selected._id} range={range} status={status} setStatus={setStatus}
              optionFilter={optionFilter} onClearOption={() => setOptionFilter(null)} />
          ) : null}
        </>
      )}
    </div>
  );
}
