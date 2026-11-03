import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { REPORT_COLORS, STATUS_COLOR, STATUS_LABEL, type ChartConfig, type ChartData } from "@/lib/form-report";

const AXIS = { fontSize: 11, fill: "#6b5b5e" };

function sliceColor(name: string, i: number, base: string) {
  const status = (Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).find(
    (k) => STATUS_LABEL[k] === name,
  );
  if (status) return STATUS_COLOR[status];
  return i === 0 ? base : REPORT_COLORS[(REPORT_COLORS.indexOf(base) + i) % REPORT_COLORS.length];
}

export function ChartBody({ cfg, data }: { cfg: ChartConfig; data: ChartData }) {
  const { rows, series, total } = data;
  if (rows.length === 0 || total === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data for the current filters.</p>;
  }

  if (cfg.type === "bar") {
    const max = Math.max(...rows.map((r) => r.value), 1);
    const isCount = cfg.measure === "count";
    return (
      <ul className="space-y-3">
        {rows.slice(0, 8).map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-foreground/85" title={r.name}>{r.name}</span>
              {cfg.labels ? (
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {r.value}
                  {isCount && total ? ` · ${Math.round((r.value / total) * 100)}%` : ""}
                </span>
              ) : null}
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, background: cfg.color }}
              />
            </div>
          </li>
        ))}
        {rows.length > 8 ? (
          <li className="text-xs text-muted-foreground">+ {rows.length - 8} more</li>
        ) : null}
      </ul>
    );
  }

  if (cfg.type === "donut") {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="relative h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" stroke="none">
                {rows.map((r, i) => (
                  <Cell key={r.name} fill={sliceColor(r.name, i, cfg.color)} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">{total}</span>
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
        </div>
        {cfg.legend ? (
          <ul className="min-w-[8rem] flex-1 space-y-1.5 text-sm">
            {rows.map((r, i) => (
              <li key={r.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: sliceColor(r.name, i, cfg.color) }} />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                {cfg.labels ? <span className="font-semibold tabular-nums">{r.value}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (cfg.type === "table") {
    return (
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-border/60 first:border-0">
              <td className="py-1.5 pr-3">{r.name}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const common = { data: rows, margin: { top: 16, right: 8, left: -18, bottom: 0 } };
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#eadfe0" vertical={false} />
      <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: "#d9cacd" }} interval={0} />
      <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
      <Tooltip cursor={{ fill: "rgba(122,31,43,0.05)" }} />
    </>
  );

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        {cfg.type === "line" ? (
          <LineChart {...common}>
            {axes}
            <Line type="monotone" dataKey="value" stroke={cfg.color} strokeWidth={2} dot={{ r: 3, fill: cfg.color }}>
              {cfg.labels ? <LabelList dataKey="value" position="top" style={AXIS} /> : null}
            </Line>
          </LineChart>
        ) : cfg.type === "area" ? (
          <AreaChart {...common}>
            {axes}
            <Area type="monotone" dataKey="value" stroke={cfg.color} fill={cfg.color} fillOpacity={0.18} strokeWidth={2}>
              {cfg.labels ? <LabelList dataKey="value" position="top" style={AXIS} /> : null}
            </Area>
          </AreaChart>
        ) : cfg.type === "stacked" && series.length ? (
          <BarChart data={rows.map((r) => ({ name: r.name, ...r.parts }))} margin={common.margin}>
            {axes}
            {cfg.legend ? <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /> : null}
            {series.map((s, i) => (
              <Bar key={s} dataKey={s} stackId="a" fill={REPORT_COLORS[i % REPORT_COLORS.length]} />
            ))}
          </BarChart>
        ) : (
          <BarChart {...common}>
            {axes}
            <Bar dataKey="value" fill={cfg.color} radius={[4, 4, 0, 0]}>
              {cfg.labels ? <LabelList dataKey="value" position="top" style={AXIS} /> : null}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
