import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Slice = { name: string; count: number; color: string };

export function ReportCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/80 bg-card p-6 shadow-sm", className)}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Donut with the total in the middle and a legend (name, count) beside it. */
export function DonutChart({ slices, label = "total" }: { slices: Slice[]; label?: string }) {
  const total = slices.reduce((n, s) => n + s.count, 0);
  const r = 52;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`${total} ${label}`}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="22" className="text-muted/70" />
          {total > 0
            ? slices
                .filter((s) => s.count > 0)
                .map((s) => {
                  const len = (s.count / total) * circ;
                  const el = (
                    <circle
                      key={s.name}
                      cx="70"
                      cy="70"
                      r={r}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="22"
                      strokeDasharray={`${len} ${circ}`}
                      strokeDashoffset={-offset}
                    >
                      <title>{`${s.name}: ${s.count}`}</title>
                    </circle>
                  );
                  offset += len;
                  return el;
                })
            : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold leading-none tabular-nums text-foreground">{total}</span>
          <span className="mt-1 text-xs text-muted-foreground">{label}</span>
        </div>
      </div>

      <ul className="min-w-[10rem] flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-foreground/85" title={s.name}>
              {s.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{s.count}</span>
          </li>
        ))}
        {slices.length === 0 ? <li className="text-sm text-muted-foreground">No requests in this period.</li> : null}
      </ul>
    </div>
  );
}

/** Vertical bars with a value above each bar and a label below. */
export function ColumnChart({ bars }: { bars: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex h-44 items-end justify-around gap-3 border-b border-border/80 px-2">
      {bars.map((b) => (
        <div key={b.label} className="flex h-full w-full max-w-[3.5rem] flex-col items-center justify-end">
          <span className="mb-1 text-sm font-bold tabular-nums text-foreground">{b.value}</span>
          <div
            className="w-full rounded-t-md bg-maroon-deep transition-all"
            style={{ height: `${(b.value / max) * 78}%`, minHeight: b.value > 0 ? 6 : 2 }}
            title={`${b.label}: ${b.value}`}
          />
        </div>
      ))}
    </div>
  );
}

export function ColumnLabels({ labels }: { labels: string[] }) {
  return (
    <div className="mt-2 flex justify-around gap-3 px-2">
      {labels.map((l) => (
        <span key={l} className="w-full max-w-[3.5rem] text-center text-[0.7rem] leading-tight text-muted-foreground">
          {l}
        </span>
      ))}
    </div>
  );
}

/** Horizontal rating bar row. */
export function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-amber-500"
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
      </div>
      <span className="w-6 text-right font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
