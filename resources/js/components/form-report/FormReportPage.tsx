import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, Printer, RefreshCw, Save, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChartBody } from "@/components/form-report/ChartBody";
import { EmptyState, PageLoader } from "@/components/layout/workspace-ui";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import type { FormRecord, TicketRecord } from "@/lib/api/types";
import {
  DIVISION_KEY,
  REPORT_COLORS,
  STATUS_KEY,
  STATUS_LABEL,
  TIME_KEY,
  choiceValues,
  computeChart,
  defaultCharts,
  displayValue,
  measureLabel,
  numberValue,
  reportFields,
  statusGroup,
  xLabel,
  type ChartConfig,
  type ChartType,
  type StatusGroup,
} from "@/lib/form-report";
import { getTicketDivision } from "@/lib/ticket-details";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const PAGE_SIZE = 8;

const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "stacked", label: "Stacked" },
  { value: "line", label: "Line" },
  { value: "donut", label: "Donut" },
  { value: "area", label: "Area" },
  { value: "histogram", label: "Histogram" },
  { value: "table", label: "Table" },
];

const DATE_PRESETS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

type Filters = {
  date: string;
  from: string;
  to: string;
  status: "all" | StatusGroup;
  choices: Record<string, string>;
  division: string;
  search: string;
  sort: "newest" | "oldest";
};

const EMPTY_FILTERS: Filters = {
  date: "all",
  from: "",
  to: "",
  status: "all",
  choices: {},
  division: "all",
  search: "",
  sort: "newest",
};

async function fetchFormTickets(formId: string) {
  const all: TicketRecord[] = [];
  for (let page = 1; page <= 40; page++) {
    const res = await api.listTickets({ limit: "50", page: String(page), formId }, "admin");
    all.push(...res.items);
    if (all.length >= res.total || res.items.length === 0) break;
  }
  return all;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function Pill({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm focus-within:ring-2 focus-within:ring-maroon/30">
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}

const selectCls = "max-w-[11rem] cursor-pointer bg-transparent text-xs font-semibold text-foreground outline-none";

function Btn({
  children,
  onClick,
  primary,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors",
        primary
          ? "bg-maroon text-white hover:bg-maroon-deep"
          : "border border-border bg-card text-foreground hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-maroon" : "bg-muted-foreground/30")}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function FormReportPage() {
  const { user } = useAuth();
  const { data: formsData, isLoading: formsLoading } = useQuery({
    queryKey: ["my-forms"],
    queryFn: () => api.myForms(),
  });
  const forms = formsData?.items ?? [];
  const [formId, setFormId] = useState<string | null>(null);
  const form: FormRecord | undefined = forms.find((f) => f._id === formId) ?? undefined;

  useEffect(() => {
    if (!formId && forms.length) {
      setFormId((forms.find((f) => f.status === "published") ?? forms[0])._id);
    }
  }, [forms, formId]);

  const {
    data: tickets,
    isLoading: ticketsLoading,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["form-report-tickets", formId],
    queryFn: () => fetchFormTickets(formId!),
    enabled: Boolean(formId),
  });

  const fields = useMemo(() => reportFields(form), [form]);
  const choiceFields = fields.filter((f) => f.kind === "choice");
  const numberFields = fields.filter((f) => f.kind === "number");

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hiddenCols, setHiddenCols] = useState<string[] | null>(null);
  const [page, setPage] = useState(1);

  // Load the saved report for this form (or the default charts) whenever the form changes.
  useEffect(() => {
    if (!form) return;
    let saved: { charts?: ChartConfig[]; hiddenCols?: string[] } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(`nmp-form-report:${form._id}`) ?? "null");
    } catch {
      saved = null;
    }
    setCharts(saved?.charts?.length ? saved.charts : defaultCharts(reportFields(form)));
    setHiddenCols(saved?.hiddenCols ?? null);
    setFilters(EMPTY_FILTERS);
    setEditingId(null);
    setPage(1);
  }, [form?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = tickets ?? [];
  const divisions = useMemo(
    () => [...new Set(all.map((t) => getTicketDivision(t)).filter(Boolean))].sort(),
    [all],
  );

  const periodLabel = useMemo(() => {
    if (filters.date === "custom") {
      return filters.from || filters.to ? `${filters.from || "…"} to ${filters.to || "today"}` : "All time";
    }
    return DATE_PRESETS.find((p) => p.value === filters.date)?.label ?? "All time";
  }, [filters.date, filters.from, filters.to]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = filters.search.trim().toLowerCase();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return all
      .filter((t) => {
        const created = new Date(t.createdAt).getTime();
        if (filters.date === "7d" && created < now - 7 * DAY_MS) return false;
        if (filters.date === "30d" && created < now - 30 * DAY_MS) return false;
        if (filters.date === "month" && created < monthStart) return false;
        if (filters.date === "custom") {
          if (filters.from && created < new Date(filters.from).getTime()) return false;
          if (filters.to && created > new Date(filters.to).getTime() + DAY_MS - 1) return false;
        }
        if (filters.status !== "all" && statusGroup(t) !== filters.status) return false;
        if (filters.division !== "all" && getTicketDivision(t) !== filters.division) return false;
        for (const [key, value] of Object.entries(filters.choices)) {
          if (!value) continue;
          const f = fields.find((r) => r.key === key);
          if (f && !choiceValues(t, f).includes(value)) return false;
        }
        if (q) {
          const hay = [t.ticketNumber, t.creatorName, ...fields.map((f) => displayValue(t, f))]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return filters.sort === "newest" ? -d : d;
      });
  }, [all, filters, fields]);

  const completed = filtered.filter((t) => statusGroup(t) === "completed").length;
  const pending = filtered.filter((t) => statusGroup(t) === "pending").length;
  const pct = (n: number) => (filtered.length ? `${Math.round((n / filtered.length) * 100)}% of submissions` : "—");
  const kpiNumber = numberFields[0];
  const kpiValues = kpiNumber ? filtered.map((t) => numberValue(t, kpiNumber)).filter((n): n is number => n !== null) : [];
  const kpiSum = kpiValues.reduce((a, b) => a + b, 0);

  // Table columns.
  const columns = useMemo(
    () => [
      { id: "ticket", label: "Ticket" },
      { id: "submitted", label: "Submitted" },
      ...fields.map((f) => ({ id: f.key, label: f.label })),
      { id: DIVISION_KEY, label: "Division" },
      { id: STATUS_KEY, label: "Status" },
    ],
    [fields],
  );
  const defaultVisible = useMemo(
    () => [
      "ticket",
      "submitted",
      ...choiceFields.slice(0, 1).map((f) => f.key),
      DIVISION_KEY,
      ...numberFields.slice(0, 1).map((f) => f.key),
      STATUS_KEY,
    ],
    [choiceFields, numberFields],
  );
  const visible = columns.filter((c) =>
    hiddenCols ? !hiddenCols.includes(c.id) : defaultVisible.includes(c.id),
  );

  const cell = (t: TicketRecord, id: string): string => {
    if (id === "ticket") return t.ticketNumber;
    if (id === "submitted") return fmtDate(t.createdAt);
    if (id === DIVISION_KEY) return getTicketDivision(t) || "—";
    if (id === STATUS_KEY) return STATUS_LABEL[statusGroup(t)];
    const f = fields.find((r) => r.key === id);
    return f ? displayValue(t, f) : "—";
  };

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const updateChart = (id: string, patch: Partial<ChartConfig>) =>
    setCharts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const editing = charts.find((c) => c.id === editingId);

  const xOptions = [
    ...choiceFields.map((f) => ({ value: f.key, label: `${f.label} · Single choice` })),
    ...numberFields.map((f) => ({ value: f.key, label: `${f.label} · Number` })),
    { value: STATUS_KEY, label: "Status · Built-in" },
    { value: DIVISION_KEY, label: "Division · Built-in" },
    { value: TIME_KEY, label: "Submitted date · Per week" },
  ];
  const measureOptions = [
    { value: "count", label: "Count of submissions" },
    ...numberFields.flatMap((f) => [
      { value: `sum:${f.key}`, label: `Total of ${f.label}` },
      { value: `avg:${f.key}`, label: `Average of ${f.label}` },
    ]),
  ];

  const saveReport = () => {
    if (!form) return;
    try {
      localStorage.setItem(`nmp-form-report:${form._id}`, JSON.stringify({ charts, hiddenCols }));
      toast.success("Report saved on this browser");
    } catch {
      toast.error("Could not save the report.");
    }
  };

  const exportRows = () => [
    visible.map((c) => c.label),
    ...filtered.map((t) => visible.map((c) => cell(t, c.id))),
  ];
  const baseName = `${(form?.title ?? "report").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    download(`${baseName}.csv`, "text/csv", exportRows().map((r) => r.map(esc).join(",")).join("\n"));
  };
  const exportExcel = () => {
    const html = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const body = exportRows()
      .map((r) => `<tr>${r.map((v) => `<td>${html(v)}</td>`).join("")}</tr>`)
      .join("");
    download(`${baseName}.xls`, "application/vnd.ms-excel", `<table>${body}</table>`);
  };
  const printPage = () => window.print();

  const exportMenu = (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-maroon px-4 text-sm font-semibold text-white hover:bg-maroon-deep"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1.5">
        {[
          { label: "PDF (print)", run: printPage },
          { label: "Excel", run: exportExcel },
          { label: "CSV", run: exportCsv },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={o.run}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
          >
            {o.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );

  if (formsLoading) return <PageLoader label="Loading forms…" />;
  if (!forms.length) {
    return (
      <div className="page-shell">
        <EmptyState title="No forms yet" description="Create a form in the Form Builder to start reporting on its submissions." />
      </div>
    );
  }

  const activeChoiceFilters = choiceFields.slice(0, 2);

  return (
    <div className="page-shell">
      {/* Header */}
      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-center text-[0.65rem] leading-tight text-muted-foreground">
              NMP
            </div>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {form?.department || user?.division || "National Museum of the Philippines"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {form?.title ?? "Form"} report
                </h1>
                <select
                  aria-label="Choose form"
                  value={formId ?? ""}
                  onChange={(e) => setFormId(e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  {forms.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </div>
              {form?.description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{form.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 text-[0.7rem]">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800 capitalize">
                  {form?.status.replace(/_/g, " ")} v{form?.version}
                </span>
                {form?.updatedAt ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    Updated {fmtDate(form.updatedAt)}
                  </span>
                ) : null}
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Period: {periodLabel}</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  {filtered.length} matching submission{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap justify-end gap-2">
              <Btn onClick={saveReport}>
                <Save className="h-4 w-4" />
                Save report
              </Btn>
              <Btn onClick={printPage}>
                <Printer className="h-4 w-4" />
                Print
              </Btn>
              {exportMenu}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Last refreshed {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                {user?.name ? ` · Prepared by ${user.name}` : ""}
              </span>
              <Btn onClick={() => void refetch()} className="h-8 px-3 text-xs">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Btn>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="mr-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Filters for the whole report
          </span>
          <Pill label="Date">
            <select className={selectCls} value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })}>
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Pill>
          {filters.date === "custom" ? (
            <>
              <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="h-8 w-36 text-xs" aria-label="From date" />
              <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="h-8 w-36 text-xs" aria-label="To date" />
            </>
          ) : null}
          <Pill label="Status">
            <select className={selectCls} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters["status"] })}>
              <option value="all">All</option>
              {(Object.keys(STATUS_LABEL) as StatusGroup[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Pill>
          {activeChoiceFilters.map((f) => (
            <Pill key={f.key} label={f.label}>
              <select
                className={selectCls}
                value={filters.choices[f.key] ?? ""}
                onChange={(e) => setFilters({ ...filters, choices: { ...filters.choices, [f.key]: e.target.value } })}
              >
                <option value="">Any</option>
                {(f.field.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Pill>
          ))}
          <Pill label="Division">
            <select className={selectCls} value={filters.division} onChange={(e) => setFilters({ ...filters, division: e.target.value })}>
              <option value="all">Any</option>
              {divisions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Pill>
          <Pill label="Group by">
            <select
              className={selectCls}
              value={charts[0]?.x ?? ""}
              onChange={(e) => charts[0] && updateChart(charts[0].id, { x: e.target.value })}
            >
              {xOptions.filter((o) => o.value !== TIME_KEY && !numberFields.some((n) => n.key === o.value)).map((o) => (
                <option key={o.value} value={o.value}>{o.label.split(" · ")[0]}</option>
              ))}
            </select>
          </Pill>
          <Pill label="Sort">
            <select className={selectCls} value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as Filters["sort"] })}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </Pill>
          <div className="relative min-w-[10rem] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search"
              aria-label="Search submissions"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-semibold text-maroon hover:underline">
            Reset filters
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Filter options are built from this form's fields. Chart-specific settings are set in each chart.
        </p>
      </section>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total submissions", value: filtered.length, hint: "Matching the filters" },
          { label: "Completed", value: completed, hint: pct(completed) },
          { label: "Pending", value: pending, hint: pct(pending) },
          kpiNumber
            ? {
                label: `Total ${kpiNumber.label}`,
                value: Math.round(kpiSum * 100) / 100,
                hint: kpiValues.length ? `Average ${(kpiSum / kpiValues.length).toFixed(1)} per submission` : "No values yet",
              }
            : { label: "Rejected", value: filtered.filter((t) => statusGroup(t) === "rejected").length, hint: "Not approved" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm">
            <p className="truncate text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{ticketsLoading ? "…" : k.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Charts + settings */}
      <div className={cn("grid items-start gap-4", editing && "xl:grid-cols-[minmax(0,1fr)_21rem]")}>
        <div>
          <div className="grid gap-4 md:grid-cols-2">
            {charts.map((cfg) => {
              const data = computeChart(cfg, filtered, fields);
              const active = cfg.id === editingId;
              return (
                <article
                  key={cfg.id}
                  className={cn(
                    "rounded-2xl border bg-card p-5 shadow-sm transition-shadow",
                    active ? "border-maroon ring-1 ring-maroon" : "border-border/80",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 text-left" onClick={() => setEditingId(active ? null : cfg.id)}>
                      <h3 className="text-sm font-bold leading-snug text-foreground">
                        {measureLabel(cfg.measure, fields)} {cfg.x === TIME_KEY ? "over time" : `by ${xLabel(cfg.x, fields)}`}
                        {active ? (
                          <span className="ml-2 rounded-full bg-maroon px-2 py-0.5 text-[0.6rem] font-semibold text-white">Editing</span>
                        ) : null}
                      </h3>
                      <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                        {CHART_TYPES.find((t) => t.value === cfg.type)?.label} · {cfg.measure === "count" ? "Count" : cfg.measure.startsWith("avg") ? "Average" : "Sum"}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        aria-label="Duplicate chart"
                        onClick={() => setCharts((cs) => [...cs, { ...cfg, id: `c${Date.now()}` }])}
                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove chart"
                        onClick={() => {
                          setCharts((cs) => cs.filter((c) => c.id !== cfg.id));
                          if (active) setEditingId(null);
                        }}
                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ChartBody cfg={cfg} data={data} />
                  </div>
                </article>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const id = `c${Date.now()}`;
              const next: ChartConfig = {
                id,
                type: "bar",
                x: DIVISION_KEY,
                measure: "count",
                split: "none",
                sort: "largest",
                color: REPORT_COLORS[charts.length % REPORT_COLORS.length],
                legend: true,
                labels: true,
              };
              setCharts((cs) => [...cs, next]);
              setEditingId(id);
            }}
            className="mt-4 w-full rounded-2xl border-2 border-dashed border-border py-3 text-sm font-semibold text-maroon hover:bg-maroon/5"
          >
            Add chart (suggested: Division by status)
          </button>
        </div>

        {editing ? (
          <aside className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm xl:sticky xl:top-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Chart settings</p>
                <p className="text-sm font-bold">
                  {measureLabel(editing.measure, fields)} by {xLabel(editing.x, fields)}
                </p>
              </div>
              <button type="button" aria-label="Close settings" onClick={() => setEditingId(null)} className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {CHART_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => updateChart(editing.id, { type: t.value })}
                  className={cn(
                    "rounded-lg border px-1 py-1.5 text-xs font-semibold",
                    editing.type === t.value ? "border-maroon bg-maroon/10 text-maroon" : "border-border hover:bg-muted",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {[
              {
                label: "X axis (group by)",
                value: editing.x,
                set: (v: string) => updateChart(editing.id, { x: v }),
                options: xOptions,
              },
              {
                label: "Measure",
                value: editing.measure,
                set: (v: string) => updateChart(editing.id, { measure: v }),
                options: measureOptions,
              },
              {
                label: "Split into series",
                value: editing.split,
                set: (v: string) => updateChart(editing.id, { split: v, ...(v !== "none" ? { type: "stacked" as ChartType } : {}) }),
                options: [
                  { value: "none", label: "None" },
                  { value: STATUS_KEY, label: "Status" },
                  { value: DIVISION_KEY, label: "Division" },
                  ...choiceFields.map((f) => ({ value: f.key, label: f.label })),
                ],
              },
              {
                label: "Sort",
                value: editing.sort,
                set: (v: string) => updateChart(editing.id, { sort: v as ChartConfig["sort"] }),
                options: [
                  { value: "largest", label: "Largest first" },
                  { value: "smallest", label: "Smallest first" },
                  { value: "az", label: "A to Z" },
                ],
              },
            ].map((s) => (
              <div key={s.label} className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{s.label}</label>
                <select
                  value={s.value}
                  onChange={(e) => s.set(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {s.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Colors</p>
              <div className="flex gap-2">
                {REPORT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use color ${c}`}
                    onClick={() => updateChart(editing.id, { color: c })}
                    className={cn("h-7 w-7 rounded-full ring-offset-2", editing.color === c && "ring-2 ring-foreground")}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Toggle label="Show legend" checked={editing.legend} onChange={(v) => updateChart(editing.id, { legend: v })} />
              <Toggle label="Show data labels" checked={editing.labels} onChange={(v) => updateChart(editing.id, { labels: v })} />
            </div>

            <p className="mt-5 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Scatter</strong> is unavailable.{" "}
              {numberFields.length < 2
                ? "This form has fewer than two number fields to compare."
                : "Use a bar or line chart to compare number fields."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Btn primary onClick={() => setEditingId(null)}>Done</Btn>
              <Btn
                onClick={() => {
                  const idx = charts.findIndex((c) => c.id === editing.id);
                  const def = defaultCharts(fields)[idx];
                  if (def) updateChart(editing.id, { ...def, id: editing.id });
                  else toast.message("This chart has no default to reset to.");
                }}
              >
                Reset chart
              </Btn>
            </div>
          </aside>
        ) : null}
      </div>

      {/* Submissions */}
      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Submissions ({filtered.length})</h2>
            <p className="text-xs text-muted-foreground">
              Columns come from this form's fields. A dash means the answer is missing, such as records from before a field existed.
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Btn>
                <SlidersHorizontal className="h-4 w-4" />
                Choose columns
              </Btn>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-72 w-60 overflow-y-auto p-2">
              {columns.map((c) => {
                const on = visible.some((v) => v.id === c.id);
                return (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const current = visible.map((v) => v.id);
                        const next = on ? current.filter((id) => id !== c.id) : [...current, c.id];
                        setHiddenCols(columns.filter((col) => !next.includes(col.id)).map((col) => col.id));
                      }}
                    />
                    <span className="truncate">{c.label}</span>
                  </label>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                {visible.map((c) => (
                  <th key={c.id} className="px-3 py-2.5 font-semibold">{c.label}</th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                <tr><td colSpan={visible.length + 1} className="px-3 py-8 text-center text-muted-foreground">Loading submissions…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={visible.length + 1} className="px-3 py-8 text-center text-muted-foreground">No submissions match the filters.</td></tr>
              ) : (
                pageRows.map((t) => (
                  <tr key={t._id} className="border-b border-border/50 last:border-0">
                    {visible.map((c) => (
                      <td key={c.id} className={cn("px-3 py-3.5", c.id === "ticket" && "font-mono text-xs")}>
                        {cell(t, c.id)}
                      </td>
                    ))}
                    <td className="px-3 py-3.5 text-right">
                      <Link
                        to="/admin/requests/$ticketId"
                        params={{ ticketId: t._id }}
                        className="rounded-lg bg-maroon/10 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-maroon/15"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <Btn onClick={() => setPage(Math.max(1, safePage - 1))} className={cn("h-8 px-3 text-xs", safePage === 1 && "pointer-events-none opacity-50")}>Previous</Btn>
            <Btn onClick={() => setPage(Math.min(pageCount, safePage + 1))} className={cn("h-8 px-3 text-xs", safePage === pageCount && "pointer-events-none opacity-50")}>Next</Btn>
          </div>
        </div>
      </section>

      {/* Bottom bar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-bold">Save or export without leaving this page</p>
          <p className="text-xs text-muted-foreground">Exports follow the current filters and chosen columns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={saveReport}>Save report</Btn>
          <Btn onClick={printPage}>PDF</Btn>
          <Btn onClick={exportExcel}>Excel</Btn>
          <Btn onClick={exportCsv}>CSV</Btn>
          <Btn onClick={printPage}>Print</Btn>
        </div>
      </section>
    </div>
  );
}
