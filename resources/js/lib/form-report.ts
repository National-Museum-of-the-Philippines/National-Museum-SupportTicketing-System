import type { FormRecord, LiveFormField, TicketRecord } from "@/lib/api/types";
import { formatFieldAnswerValue } from "@/lib/form-field-values";
import { resolveAnswerForVariable } from "@/lib/placement-values";
import { getTicketDivision } from "@/lib/ticket-details";

export const REPORT_COLORS = ["#7a1f2b", "#e3a33b", "#1f7a6b", "#3e5ba9", "#8a5db0"];

export type StatusGroup = "completed" | "pending" | "rejected";
export const STATUS_LABEL: Record<StatusGroup, string> = {
  completed: "Completed",
  pending: "Pending",
  rejected: "Rejected",
};
export const STATUS_COLOR: Record<StatusGroup, string> = {
  completed: "#1f7a6b",
  pending: "#e3a33b",
  rejected: "#7b8794",
};

export function statusGroup(t: TicketRecord): StatusGroup {
  if (t.status === "closed") return "completed";
  if (t.status === "rejected") return "rejected";
  return "pending";
}

export type ReportField = {
  key: string;
  label: string;
  kind: "choice" | "number" | "other";
  multi: boolean;
  field: LiveFormField;
};

const CHOICE_TYPES = ["dropdown", "radio", "checkbox"];
const SKIP_TYPES = ["signature", "file"];

export function reportFields(form: FormRecord | undefined): ReportField[] {
  return (form?.fields ?? [])
    .filter((f) => !SKIP_TYPES.includes(f.type))
    .map((f) => ({
      key: f.variable || f.id,
      label: f.label || f.variable,
      kind: CHOICE_TYPES.includes(f.type) ? "choice" : f.type === "number" ? "number" : "other",
      multi: f.type === "checkbox",
      field: f,
    }));
}

export function answerOf(t: TicketRecord, f: ReportField): unknown {
  return resolveAnswerForVariable(t.answers ?? {}, f.field.variable);
}

export function choiceValues(t: TicketRecord, f: ReportField): string[] {
  const raw = answerOf(t, f);
  const list = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return list.map((v) => String(v).trim()).filter(Boolean);
}

export function numberValue(t: TicketRecord, f: ReportField): number | null {
  const raw = answerOf(t, f);
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function displayValue(t: TicketRecord, f: ReportField): string {
  const raw = answerOf(t, f);
  if (raw === undefined || raw === null || raw === "") return "—";
  return formatFieldAnswerValue(f.field, raw) || "—";
}

export const DIVISION_KEY = "__division";
export const STATUS_KEY = "__status";
export const TIME_KEY = "__time";

export type ChartType = "bar" | "stacked" | "line" | "donut" | "area" | "histogram" | "table";
export type ChartSort = "largest" | "smallest" | "az";

export type ChartConfig = {
  id: string;
  type: ChartType;
  x: string;
  measure: string; // "count" | "sum:<key>" | "avg:<key>"
  split: string; // "none" | field key | STATUS_KEY
  sort: ChartSort;
  color: string;
  legend: boolean;
  labels: boolean;
};

export type ChartRow = { name: string; value: number; parts: Record<string, number>; order?: number };
export type ChartData = { rows: ChartRow[]; series: string[]; total: number };

const WEEK_MS = 7 * 86_400_000;

function weekStart(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function groupKeys(t: TicketRecord, x: string, fields: ReportField[]): Array<{ name: string; order?: number }> {
  if (x === STATUS_KEY) return [{ name: STATUS_LABEL[statusGroup(t)] }];
  if (x === DIVISION_KEY) return [{ name: getTicketDivision(t) || "Unspecified" }];
  if (x === TIME_KEY) {
    const start = weekStart(t.createdAt);
    return [
      {
        name: new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        order: start,
      },
    ];
  }
  const f = fields.find((r) => r.key === x);
  if (!f) return [{ name: "—" }];
  if (f.kind === "choice") {
    const vals = choiceValues(t, f);
    return (vals.length ? vals : ["—"]).map((name) => ({ name }));
  }
  return [{ name: displayValue(t, f) }];
}

export function computeChart(cfg: ChartConfig, tickets: TicketRecord[], fields: ReportField[]): ChartData {
  const [mKind, mKey] = cfg.measure.split(":");
  const mField = fields.find((f) => f.key === mKey);
  const acc = new Map<string, { sum: number; count: number; order?: number; parts: Map<string, { sum: number; count: number }> }>();

  const add = (bucket: { sum: number; count: number }, t: TicketRecord) => {
    if (mKind === "count" || !mField) {
      bucket.sum += 1;
      bucket.count += 1;
      return;
    }
    const n = numberValue(t, mField);
    if (n !== null) {
      bucket.sum += n;
      bucket.count += 1;
    }
  };

  if (cfg.type === "histogram") {
    const f = fields.find((r) => r.key === cfg.x && r.kind === "number") ?? fields.find((r) => r.kind === "number");
    const values = f ? tickets.map((t) => numberValue(t, f)).filter((n): n is number => n !== null) : [];
    if (!values.length) return { rows: [], series: [], total: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = Math.min(5, Math.max(1, new Set(values).size));
    const width = (max - min) / bins || 1;
    const rows: ChartRow[] = Array.from({ length: bins }, (_, i) => {
      const lo = min + i * width;
      const hi = i === bins - 1 ? max : min + (i + 1) * width;
      return { name: `${Math.round(lo)}–${Math.round(hi)}`, value: 0, parts: {}, order: i };
    });
    for (const v of values) rows[Math.min(bins - 1, Math.floor((v - min) / width))].value += 1;
    return { rows, series: [], total: values.length };
  }

  const splitField = cfg.split === "none" ? undefined : fields.find((f) => f.key === cfg.split);
  const seriesSet = new Set<string>();

  for (const t of tickets) {
    for (const g of groupKeys(t, cfg.x, fields)) {
      let entry = acc.get(g.name);
      if (!entry) {
        entry = { sum: 0, count: 0, order: g.order, parts: new Map() };
        acc.set(g.name, entry);
      }
      add(entry, t);
      if (cfg.type === "stacked" && cfg.split !== "none") {
        const names = groupKeys(t, cfg.split, splitField ? fields : fields);
        for (const s of names) {
          seriesSet.add(s.name);
          let part = entry.parts.get(s.name);
          if (!part) {
            part = { sum: 0, count: 0 };
            entry.parts.set(s.name, part);
          }
          add(part, t);
        }
      }
    }
  }

  const val = (b: { sum: number; count: number }) =>
    mKind === "avg" ? (b.count ? Math.round((b.sum / b.count) * 10) / 10 : 0) : b.sum;

  let rows: ChartRow[] = [...acc].map(([name, e]) => ({
    name,
    value: val(e),
    order: e.order,
    parts: Object.fromEntries([...e.parts].map(([k, b]) => [k, val(b)])),
  }));

  if (cfg.x === TIME_KEY) rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  else if (cfg.sort === "largest") rows.sort((a, b) => b.value - a.value);
  else if (cfg.sort === "smallest") rows.sort((a, b) => a.value - b.value);
  else rows.sort((a, b) => a.name.localeCompare(b.name));

  // Fill empty weeks so a line does not skip over quiet periods.
  if (cfg.x === TIME_KEY && rows.length > 1) {
    const filled: ChartRow[] = [];
    const byOrder = new Map(rows.map((r) => [r.order ?? 0, r]));
    for (let t = rows[0].order ?? 0; t <= (rows[rows.length - 1].order ?? 0); t += WEEK_MS) {
      filled.push(
        byOrder.get(t) ?? {
          name: new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          value: 0,
          parts: {},
          order: t,
        },
      );
    }
    rows = filled;
  }

  return { rows, series: [...seriesSet], total: rows.reduce((n, r) => n + r.value, 0) };
}

export function xLabel(x: string, fields: ReportField[]) {
  if (x === STATUS_KEY) return "Status";
  if (x === DIVISION_KEY) return "Division";
  if (x === TIME_KEY) return "Submitted date";
  return fields.find((f) => f.key === x)?.label ?? x;
}

export function measureLabel(measure: string, fields: ReportField[]) {
  const [kind, key] = measure.split(":");
  if (kind === "count") return "Submissions";
  const f = fields.find((r) => r.key === key);
  return `${kind === "avg" ? "Average" : "Total"} ${f?.label ?? ""}`.trim();
}

export function defaultCharts(fields: ReportField[]): ChartConfig[] {
  const choice = fields.find((f) => f.kind === "choice");
  const number = fields.find((f) => f.kind === "number");
  const base = { measure: "count", split: "none", sort: "largest" as ChartSort, legend: true, labels: true };
  const charts: ChartConfig[] = [
    { id: "c1", type: "bar", x: choice?.key ?? DIVISION_KEY, color: REPORT_COLORS[0], ...base },
    { id: "c2", type: "donut", x: STATUS_KEY, color: REPORT_COLORS[0], ...base },
    { id: "c3", type: "line", x: TIME_KEY, color: REPORT_COLORS[0], ...base },
  ];
  charts.push(
    number
      ? { id: "c4", type: "histogram", x: number.key, color: REPORT_COLORS[0], ...base }
      : { id: "c4", type: "bar", x: DIVISION_KEY, color: REPORT_COLORS[1], ...base },
  );
  return charts;
}
