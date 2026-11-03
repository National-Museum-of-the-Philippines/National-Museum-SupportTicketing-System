import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Settings2, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageLoader } from "@/components/layout/workspace-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import type { DynamicFormReport as DynamicReport, ReportDisplayType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const COLORS = ["#7a1f2b", "#1f7a6b", "#e3a33b", "#3e5ba9", "#8a6f7a", "#c2527a"];

const TYPE_OPTIONS: Array<{ value: ReportDisplayType; label: string }> = [
  { value: "donut", label: "Donut chart" },
  { value: "pie", label: "Pie chart" },
  { value: "bar", label: "Bar chart" },
  { value: "column", label: "Column chart" },
  { value: "tiles", label: "Number tiles" },
  { value: "table", label: "Table list" },
  { value: "none", label: "Not shown" },
];

const FIELD_KIND: Record<string, string> = {
  textbox: "Text", textarea: "Long text", dropdown: "Dropdown", checkbox: "Checkbox group", radio: "Radio group",
  date: "Date", time: "Time", datetime: "Date & time", email: "Email", number: "Number",
};

function Donut({ items, total, pie = false }: { items: Array<{ label: string; count: number }>; total: number; pie?: boolean }) {
  const r = pie ? 35 : 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-[112px] w-[112px] shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`${total} ticks`}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1e9ea" strokeWidth={pie ? 70 : 20} />
          {total > 0 &&
            items.map((it, i) => {
              const len = (it.count / total) * c;
              const el = (
                <circle key={it.label} cx="70" cy="70" r={r} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={pie ? 70 : 20}
                  strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
              );
              offset += len;
              return el;
            })}
        </svg>
        {pie ? null : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold leading-none">{total}</span>
            <span className="text-[0.65rem] text-muted-foreground">ticks</span>
          </div>
        )}
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <span className="w-8 text-right font-semibold tabular-nums">{it.count}</span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{total ? Math.round((it.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ items }: { items: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="leading-tight">{it.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-maroon/10">
            <span className="block h-full rounded-full bg-maroon" style={{ width: `${(it.count / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{it.count}</span>
        </li>
      ))}
    </ul>
  );
}

function Columns({ items }: { items: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="flex h-48 items-end gap-3 overflow-x-auto pt-4">
      {items.map((it, i) => (
        <div key={it.label} className="flex h-full min-w-[3.5rem] flex-1 flex-col justify-end text-center">
          <span className="mb-1 text-xs font-semibold tabular-nums">{it.count}</span>
          <span className="w-full rounded-t-md" style={{ height: `${(it.count / max) * 80}%`, minHeight: 3, background: COLORS[i % COLORS.length] }} />
          <span className="mt-2 line-clamp-2 text-[0.7rem] leading-tight text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function Tiles({ items, total }: { items: Array<{ label: string; count: number }>; total: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((it, i) => (
        <div key={it.label} className="rounded-xl border border-border/70 p-3" style={{ borderTopColor: COLORS[i % COLORS.length], borderTopWidth: 3 }}>
          <p className="text-2xl font-bold tabular-nums">{it.count}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{it.label}</p>
          <p className="text-[0.65rem] text-muted-foreground">{total ? Math.round((it.count / total) * 100) : 0}%</p>
        </div>
      ))}
    </div>
  );
}

function TableList({ items }: { items: Array<{ label: string; count: number }> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="w-8 py-1.5 font-medium">#</th>
          <th className="py-1.5 font-medium">Answer</th>
          <th className="py-1.5 text-right font-medium">Requests</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={it.label} className="border-b border-border/60 last:border-0">
            <td className="py-2.5 text-muted-foreground">{i + 1}</td>
            <td className="py-2.5">{it.label}</td>
            <td className="py-2.5 text-right font-semibold tabular-nums">{it.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Draws the card on a canvas and downloads it as a PNG picture. */
function exportCard(card: DynamicReport["cards"][number], context: ExportContext) {
  const W = 900;
  const PAD = 36;
  const FONT = "'Segoe UI', Arial, sans-serif";
  const items = card.items;
  const total = card.total;
  const pct = (n: number) => `${total ? Math.round((n / total) * 100) : 0}%`;
  const max = Math.max(1, ...items.map((i) => i.count));
  const rowH = card.type === "table" ? 40 : card.type === "bar" ? 44 : 32;
  const body =
    card.type === "donut" || card.type === "pie" ? Math.max(230, items.length * 32 + 20)
    : card.type === "column" ? 300
    : card.type === "tiles" ? Math.ceil(items.length / 3) * 110
    : items.length * rowH + (card.type === "table" ? 40 : 0);
  const H = 130 + body + 50;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const g = canvas.getContext("2d");
  if (!g) return;
  g.scale(scale, scale);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);
  g.textBaseline = "middle";

  const text = (t: string, x: number, y: number, o: { size?: number; weight?: string; color?: string; align?: CanvasTextAlign; max?: number } = {}) => {
    g.font = `${o.weight ?? "400"} ${o.size ?? 15}px ${FONT}`;
    g.fillStyle = o.color ?? "#1c1917";
    g.textAlign = o.align ?? "left";
    let out = t;
    if (o.max) while (out.length > 1 && g.measureText(out).width > o.max) out = out.slice(0, -2) + "…";
    g.fillText(out, x, y);
  };

  const subtitle = { donut: "Donut chart", pie: "Pie chart", bar: "Bar chart", column: "Column chart", tiles: "Number tiles", table: "Table list" }[card.type];
  text(card.label, PAD, 44, { size: 22, weight: "700" });
  text(`${subtitle} · closed tickets only`, PAD, 72, { size: 14, color: "#6b5b5f" });
  text(`${context.form} · ${context.from} to ${context.to}`, PAD, 94, { size: 12, color: "#8a7a7e" });
  const top = 130;

  if (items.length === 0) {
    text("No answers yet.", W / 2, top + 40, { align: "center", color: "#6b5b5f" });
  } else if (card.type === "donut" || card.type === "pie") {
    const cx = PAD + 100;
    const cy = top + body / 2;
    let start = -Math.PI / 2;
    items.forEach((it, i) => {
      const ang = (it.count / Math.max(1, total)) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, 100, start, start + ang);
      g.closePath();
      g.fillStyle = COLORS[i % COLORS.length];
      g.fill();
      start += ang;
    });
    if (card.type === "donut") {
      g.beginPath();
      g.arc(cx, cy, 62, 0, Math.PI * 2);
      g.fillStyle = "#ffffff";
      g.fill();
      text(String(total), cx, cy - 8, { size: 28, weight: "700", align: "center" });
      text("ticks", cx, cy + 16, { size: 12, color: "#6b5b5f", align: "center" });
    }
    items.forEach((it, i) => {
      const y = top + (body - items.length * 32) / 2 + i * 32 + 16;
      g.fillStyle = COLORS[i % COLORS.length];
      g.beginPath();
      g.arc(PAD + 260, y, 6, 0, Math.PI * 2);
      g.fill();
      text(it.label, PAD + 278, y, { max: 340 });
      text(String(it.count), W - PAD - 60, y, { weight: "700", align: "right" });
      text(pct(it.count), W - PAD, y, { size: 13, color: "#6b5b5f", align: "right" });
    });
  } else if (card.type === "bar") {
    items.forEach((it, i) => {
      const y = top + i * rowH + rowH / 2;
      text(it.label, PAD, y, { max: 250 });
      g.fillStyle = "#f1e9ea";
      g.fillRect(PAD + 270, y - 7, W - PAD * 2 - 270 - 50, 14);
      g.fillStyle = "#7a1f2b";
      g.fillRect(PAD + 270, y - 7, ((W - PAD * 2 - 270 - 50) * it.count) / max, 14);
      text(String(it.count), W - PAD, y, { weight: "700", align: "right" });
    });
  } else if (card.type === "column") {
    const colW = (W - PAD * 2) / items.length;
    items.forEach((it, i) => {
      const h = (it.count / max) * 190;
      const x = PAD + i * colW + colW * 0.15;
      g.fillStyle = COLORS[i % COLORS.length];
      g.fillRect(x, top + 230 - h, colW * 0.7, Math.max(h, 3));
      text(String(it.count), x + colW * 0.35, top + 230 - h - 12, { weight: "700", align: "center", size: 14 });
      text(it.label, x + colW * 0.35, top + 255, { size: 12, color: "#6b5b5f", align: "center", max: colW - 6 });
    });
  } else if (card.type === "tiles") {
    const tw = (W - PAD * 2 - 32) / 3;
    items.forEach((it, i) => {
      const x = PAD + (i % 3) * (tw + 16);
      const y = top + Math.floor(i / 3) * 110;
      g.strokeStyle = "#e7dede";
      g.strokeRect(x, y, tw, 94);
      g.fillStyle = COLORS[i % COLORS.length];
      g.fillRect(x, y, tw, 4);
      text(String(it.count), x + 16, y + 38, { size: 28, weight: "700" });
      text(it.label, x + 16, y + 68, { size: 13, color: "#6b5b5f", max: tw - 32 });
      text(pct(it.count), x + tw - 16, y + 38, { size: 12, color: "#8a7a7e", align: "right" });
    });
  } else {
    text("#", PAD, top + 10, { size: 12, color: "#6b5b5f" });
    text("Answer", PAD + 40, top + 10, { size: 12, color: "#6b5b5f" });
    text("Requests", W - PAD, top + 10, { size: 12, color: "#6b5b5f", align: "right" });
    g.fillStyle = "#e7dede";
    g.fillRect(PAD, top + 26, W - PAD * 2, 1);
    items.forEach((it, i) => {
      const y = top + 40 + i * rowH + rowH / 2;
      text(String(i + 1), PAD, y, { color: "#6b5b5f" });
      text(it.label, PAD + 40, y, { max: W - PAD * 2 - 160 });
      text(String(it.count), W - PAD, y, { weight: "700", align: "right" });
      g.fillStyle = "#f1e9ea";
      g.fillRect(PAD, y + rowH / 2, W - PAD * 2, 1);
    });
  }

  g.strokeStyle = "#e7dede";
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, W - 1, H - 1);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${card.label.replace(/\W+/g, "-")}-${context.to}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

type ExportContext = { form: string; from: string; to: string };

/** Every answer of a table list, as an Excel sheet. */
function exportCardExcel(card: DynamicReport["cards"][number], context: ExportContext) {
  const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const row = (cells: Array<string | number>) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
  const html = `<table>
    ${row([context.form, card.label, `${context.from} to ${context.to}`])}
    ${row([])}
    ${row(["#", "Answer", "Requests"])}
    ${card.all.map((i, n) => row([n + 1, i.label, i.count])).join("")}
    ${row(["", "Total", card.total])}
  </table>`;
  const url = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${card.label.replace(/\W+/g, "-")}-${context.to}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Every answer of a table list on printable pages; "Save as PDF" in the print dialog makes the PDF. */
function exportCardPdf(card: DynamicReport["cards"][number], context: ExportContext) {
  const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><title>${esc(card.label)}</title>
    <style>body{font:14px 'Segoe UI',Arial,sans-serif;margin:32px;color:#1c1917}h1{font-size:20px;margin:0}
    p{color:#6b5b5f;margin:4px 0 16px}table{width:100%;border-collapse:collapse}
    th,td{padding:8px 6px;border-bottom:1px solid #e7dede;text-align:left}th:last-child,td:last-child{text-align:right}
    thead{display:table-header-group}tr{page-break-inside:avoid}</style>
    <h1>${esc(card.label)}</h1><p>${esc(context.form)} · ${esc(context.from)} to ${esc(context.to)} · closed tickets only · ${card.total} requests</p>
    <table><thead><tr><th>#</th><th>Answer</th><th>Requests</th></tr></thead><tbody>
    ${card.all.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.label)}</td><td>${i.count}</td></tr>`).join("")}
    </tbody></table>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function ExportMenu({ card, context }: { card: DynamicReport["cards"][number]; context: ExportContext }) {
  const [open, setOpen] = useState(false);
  const btn = "shrink-0 rounded-md bg-maroon px-3 py-1 text-xs font-semibold text-white hover:bg-maroon-deep disabled:opacity-40";
  if (card.type !== "table") {
    return <button type="button" className={btn} disabled={card.items.length === 0} onClick={() => exportCard(card, context)} aria-label={`Export ${card.label}`}>Export</button>;
  }
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button type="button" className={btn} disabled={card.items.length === 0} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        Export ▾
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card text-sm shadow-lg">
          <button role="menuitem" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={pick(() => exportCard(card, context))}>Picture (top {card.items.length})</button>
          <button role="menuitem" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={pick(() => exportCardExcel(card, context))}>Excel (all {card.distinct})</button>
          <button role="menuitem" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={pick(() => exportCardPdf(card, context))}>PDF (all {card.distinct})</button>
        </div>
      ) : null}
    </div>
  );
}

function ReportCard({ card, context }: { card: DynamicReport["cards"][number]; context: ExportContext }) {
  const sub =
    card.type === "donut" ? "Donut chart" : card.type === "pie" ? "Pie chart" : card.type === "bar" ? "Bar chart" : card.type === "column" ? "Column chart" : card.type === "tiles" ? "Number tiles" : `Top ${Math.min(5, card.distinct)} most frequent`;
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", card.type === "bar" && "lg:col-span-1")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{card.label}</h3>
          <p className="text-xs text-muted-foreground">{sub} · closed tickets only</p>
        </div>
        <ExportMenu card={card} context={context} />
      </div>
      {card.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No answers yet.</p>
      ) : card.type === "donut" || card.type === "pie" ? (
        <Donut items={card.items} total={card.total} pie={card.type === "pie"} />
      ) : card.type === "bar" ? (
        <Bars items={card.items} />
      ) : card.type === "column" ? (
        <Columns items={card.items} />
      ) : card.type === "tiles" ? (
        <Tiles items={card.items} total={card.total} />
      ) : (
        <>
          <TableList items={card.items} />
          {card.distinct > card.items.length ? (
            <p className="mt-3 text-xs text-muted-foreground">{card.distinct - card.items.length} more not shown</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function SettingsModal({ formId, formTitle, open, onClose }: { formId: string; formTitle: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["form-report-settings", formId],
    queryFn: () => api.formReportSettings(formId, "admin"),
    enabled: open,
  });
  // saved = rows the admin pressed Save on (or that were stored earlier); picked = what the dropdown shows now.
  const [saved, setSaved] = useState<Record<string, ReportDisplayType>>({});
  const [picked, setPicked] = useState<Record<string, ReportDisplayType | "">>({});

  useEffect(() => {
    if (!data) return;
    const s: Record<string, ReportDisplayType> = {};
    for (const f of data.fields) if (f.chosen) s[f.fieldId] = f.chosen;
    setSaved(s);
    setPicked(s);
  }, [data]);

  const apply = useMutation({
    mutationFn: () => api.saveFormReportSettings(formId, saved, "admin"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form-report-settings", formId] });
      qc.invalidateQueries({ queryKey: ["form-report-dynamic", formId] });
      onClose();
    },
  });

  const fields = data?.fields ?? [];
  const savedCount = fields.filter((f) => saved[f.fieldId]).length;
  const dirty = fields.filter((f) => picked[f.fieldId] && picked[f.fieldId] !== saved[f.fieldId]).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-bold">Report settings</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {formTitle} · Choose how each field appears in the report.
          </DialogDescription>
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          <div className="grid grid-cols-[1fr_12rem_6rem] gap-3 bg-muted/40 px-6 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground max-sm:hidden">
            <span>Data list</span><span>Type</span><span className="text-right">Action</span>
          </div>
          {isLoading ? <p className="px-6 py-8 text-sm text-muted-foreground">Loading fields…</p> : null}
          {fields.map((f, i) => {
            const value = picked[f.fieldId] ?? "";
            const isSaved = Boolean(saved[f.fieldId]) && saved[f.fieldId] === value;
            return (
              <div key={f.fieldId} className="grid grid-cols-1 items-center gap-2 border-t border-border/70 px-6 py-3 sm:grid-cols-[1fr_12rem_6rem] sm:gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold"><span className="mr-2 font-normal text-muted-foreground">{i + 1}.</span>{f.label}</p>
                  <p className="pl-5 text-xs text-muted-foreground">
                    {FIELD_KIND[f.type] ?? f.type}{f.optionCount ? ` (${f.optionCount} options)` : ""}
                  </p>
                </div>
                <select
                  aria-label={`Report type for ${f.label}`}
                  value={value}
                  onChange={(e) => setPicked((p) => ({ ...p, [f.fieldId]: e.target.value as ReportDisplayType }))}
                  className="min-h-[40px] w-full rounded-lg border border-border bg-card px-3 text-sm"
                >
                  <option value="" disabled>Select type</option>
                  {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <div className="sm:text-right">
                  {isSaved ? (
                    <span className="text-sm font-semibold text-emerald-700">✓ Saved</span>
                  ) : (
                    <button
                      type="button"
                      disabled={!value}
                      onClick={() => setSaved((s) => ({ ...s, [f.fieldId]: value as ReportDisplayType }))}
                      className={cn(
                        "min-h-[40px] rounded-lg border px-4 text-sm font-semibold disabled:opacity-40",
                        dirty > 0 && value && value !== saved[f.fieldId] ? "border-maroon bg-maroon text-white" : "border-border bg-card",
                      )}
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {savedCount} of {fields.length} fields saved · {dirty > 0 ? `${dirty} change${dirty > 1 ? "s" : ""} not saved yet` : "Unsaved rows are skipped"}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="min-h-[40px] rounded-lg border border-border bg-card px-4 text-sm font-semibold">Cancel</button>
            <button
              type="button"
              disabled={savedCount === 0 || apply.isPending}
              onClick={() => apply.mutate()}
              className="min-h-[40px] rounded-lg bg-maroon px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {apply.isPending ? "Applying…" : "Apply changes"}
            </button>
          </div>
        </div>
        {apply.isError ? <p className="px-6 pb-4 text-sm text-rose-700">Could not save the settings. Try again.</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ onConfigure }: { onConfigure: () => void }) {
  const steps = ["Click Report settings", "Pick a chart or table for each field of this form", "Click Apply changes"];
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-maroon/10 text-maroon">
        <Table2 className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-bold">No available report</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        This form has no report format yet. Set up what the report will show first: choose how each field from the Form Builder is displayed, then apply your changes.
      </p>
      <button type="button" onClick={onConfigure} className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-maroon px-5 text-sm font-semibold text-white">
        <Settings2 className="h-4 w-4" aria-hidden /> Report settings
      </button>
      <ol className="mx-auto mt-8 grid max-w-3xl gap-4 border-t border-border pt-6 text-left text-sm sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon/10 text-xs font-bold text-maroon">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DynamicFormReport() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [month, setMonth] = useState("all");
  const [formId, setFormId] = useState("");
  const [open, setOpen] = useState(false);
  const range = useMemo(() => {
    if (month === "all") return { from: `${year}-01-01`, to: `${year}-12-31` };
    const m = Number(month);
    const last = new Date(Number(year), m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
  }, [year, month]);

  const { data: formsData, isLoading: formsLoading, isError: formsError } = useQuery({
    queryKey: ["form-report-forms"],
    queryFn: () => api.formReportForms("admin"),
  });
  const forms = formsData?.items ?? [];
  const selected = forms.find((f) => f._id === formId) ?? forms[0];

  const { data: report, isLoading } = useQuery<DynamicReport>({
    queryKey: ["form-report-dynamic", selected?._id, range],
    queryFn: () => api.formReportDynamic(selected!._id, range, "admin"),
    enabled: Boolean(selected),
  });

  if (formsLoading) return <PageLoader />;
  if (formsError) return <p className="p-6 text-sm text-rose-700">Could not load your forms.</p>;
  if (!selected) {
    return <p className="p-6 text-sm text-muted-foreground">You have no published forms yet. Publish a form from the Form Builder to build its report.</p>;
  }

  const configured = Boolean(report?.configured);
  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="form">Form</label>
            <select id="form" value={selected._id} onChange={(e) => setFormId(e.target.value)}
              className="min-h-[44px] min-w-[16rem] rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm">
              {forms.map((f) => <option key={f._id} value={f._id}>{f.title}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="year">Year</label>
            <select id="year" value={year} onChange={(e) => setYear(e.target.value)}
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm">
              {Array.from({ length: 4 }, (_, i) => String(thisYear - i)).map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="month">Month</label>
            <select id="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm">
              <option value="all">All months</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i + 1)}>{new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" })}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-maroon/30 bg-card px-4 text-sm font-semibold text-maroon shadow-sm">
            <Settings2 className="h-4 w-4" aria-hidden /> Report settings
          </button>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !configured || !report ? (
        <EmptyState onConfigure={() => setOpen(true)} />
      ) : (
        <>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden /> {report.closedCount} closed ticket{report.closedCount === 1 ? "" : "s"}
          </p>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {report.cards.map((c) => <ReportCard key={c.fieldId} card={c} context={{ form: selected.title, ...range }} />)}
          </div>
          {report.hiddenCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {report.hiddenCount} field{report.hiddenCount === 1 ? " is" : "s are"} hidden · change anytime in Report settings
            </p>
          ) : null}
        </>
      )}

      <SettingsModal key={selected._id} formId={selected._id} formTitle={selected.title} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
