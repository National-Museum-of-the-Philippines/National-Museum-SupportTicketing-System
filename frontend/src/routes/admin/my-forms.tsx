import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Eye,
  FileText,
  PieChart as PieIcon,
  Star,
  Tag,
  Trophy,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AdminFormViewerDialog } from "@/components/admin/AdminFormViewerDialog";
import {
  ActionLink,
  EmptyState,
  FormStatusBadge,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { FormStatus, MyFormsAnalytics, NamedCount } from "@/lib/api/types";
import { ensureAdminOnly } from "@/lib/admin-only-guard";
import { ADMIN_FORMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/my-forms")({
  beforeLoad: () => ensureAdminOnly(),
  component: MyFormsPage,
});

const MAROON = "#7a1f2b";
const SERVICE_COLORS = ["#7a1f2b", "#0f766e", "#d97706", "#7c3aed", "#db2777", "#2563eb"];

function formatChange(pct: number | null) {
  if (pct === null) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs last month`;
}

function ChangeHint({ pct }: { pct: number | null }) {
  const label = formatChange(pct);
  if (!label) return <p className="mt-2 text-xs text-slate-400">No prior month data</p>;
  const up = (pct ?? 0) >= 0;
  return (
    <p className={cn("mt-2 flex items-center gap-1 text-xs font-medium", up ? "text-emerald-600" : "text-rose-600")}>
      <ArrowUpRight className={cn("h-3.5 w-3.5", !up && "rotate-90")} aria-hidden />
      {label}
    </p>
  );
}

function SummaryCard({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
  changePct,
}: {
  icon: typeof FileText;
  iconClass: string;
  label: string;
  value: string;
  hint?: string;
  changePct?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconClass)}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
          {changePct !== undefined ? <ChangeHint pct={changePct} /> : null}
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  icon: typeof Trophy;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconClass)}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function DivisionBars({ data }: { data: NamedCount[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No division data yet</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#64748b", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(122,31,43,0.05)" }}
          contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }}
        />
        <Bar dataKey="count" fill={MAROON} radius={[0, 8, 8, 0]} barSize={16} label={{ position: "right", fill: "#64748b", fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ServiceDonut({ data, total }: { data: NamedCount[]; total: number }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No service data yet</p>;
  }
  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={SERVICE_COLORS[i % SERVICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-[11px] font-medium text-slate-500">Total</p>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {data.map((item, i) => (
          <li key={item.name} className="flex items-center gap-2 text-xs text-slate-600">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: SERVICE_COLORS[i % SERVICE_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            <span className="shrink-0 font-semibold text-slate-800">{item.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthlyTrend({ data }: { data: MyFormsAnalytics["monthlyTrend"] }) {
  const hasData = data.some((d) => d.count > 0);
  return (
    <div className="h-56">
      {!hasData ? (
        <p className="flex h-full items-center justify-center text-sm text-slate-400">
          No monthly trend yet
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="myFormsTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MAROON} stopOpacity={0.28} />
                <stop offset="100%" stopColor={MAROON} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="count"
              name="Requests"
              stroke={MAROON}
              strokeWidth={2.4}
              fill="url(#myFormsTrend)"
              dot={{ r: 3.5, fill: MAROON, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function MyFormsPage() {
  const qc = useQueryClient();
  const [viewForm, setViewForm] = useState<{
    id: string;
    title: string;
    refNumber: string;
  } | null>(null);
  const [chartFormId, setChartFormId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["my-forms-analytics"],
    queryFn: () => api.myFormsAnalytics(),
  });

  const submit = useMutation({
    mutationFn: (id: string) => api.submitFormForReview(id),
    onSuccess: (res) => {
      toast.success(`"${res.form.title}" sent to Records`);
      void qc.invalidateQueries({ queryKey: ["my-forms"] });
      void qc.invalidateQueries({ queryKey: ["my-forms-analytics"] });
      void qc.invalidateQueries({ queryKey: ["records-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["records-pending"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const summary = data?.summary;
  const forms = data?.forms ?? [];

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="My Forms Analytics"
        description="Overview of form submissions and service requests."
        meta={
          data?.rangeLabel ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              {data.rangeLabel}
            </span>
          ) : null
        }
        actions={<ActionLink to={ADMIN_FORMS}>+ New Form</ActionLink>}
      />

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={FileText}
          iconClass="bg-rose-50 text-[#7a1f2b]"
          label="Total Requests"
          value={isLoading ? "…" : String(summary?.totalRequests ?? 0)}
          changePct={summary?.totalRequestsChangePct ?? null}
        />
        <SummaryCard
          icon={Users}
          iconClass="bg-violet-50 text-violet-700"
          label="Total Divisions / Sections"
          value={isLoading ? "…" : String(summary?.totalDivisions ?? 0)}
          changePct={summary?.divisionsChangePct ?? null}
        />
        <SummaryCard
          icon={Star}
          iconClass="bg-amber-50 text-amber-700"
          label="Most Requested Service"
          value={isLoading ? "…" : summary?.mostRequestedService ?? "—"}
          hint={
            summary
              ? `${summary.mostRequestedCount} requests (${summary.mostRequestedPercent}%)`
              : undefined
          }
        />
        <SummaryCard
          icon={CalendarDays}
          iconClass="bg-emerald-50 text-emerald-700"
          label="Requests This Month"
          value={isLoading ? "…" : String(summary?.requestsThisMonth ?? 0)}
          changePct={summary?.requestsThisMonthChangePct ?? null}
        />
      </div>

      {/* Charts + insights */}
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Requests by Division / Section
          </h3>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
          ) : (
            <DivisionBars data={data?.byDivision ?? []} />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Requests by Service Category
          </h3>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
          ) : (
            <ServiceDonut
              data={data?.byService ?? []}
              total={summary?.totalRequests ?? 0}
            />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Quick Insights</h3>
          <div className="space-y-2.5">
            <InsightCard
              icon={Trophy}
              iconClass="bg-amber-100 text-amber-700"
              label="Most Active Division"
              value={data?.insights.mostActiveDivision ?? "—"}
            />
            <InsightCard
              icon={Tag}
              iconClass="bg-sky-100 text-sky-700"
              label="Most Requested Service"
              value={data?.insights.mostRequestedService ?? "—"}
            />
            <InsightCard
              icon={ArrowUpRight}
              iconClass="bg-emerald-100 text-emerald-700"
              label="Fastest Growing"
              value={data?.insights.fastestGrowing ?? "—"}
            />
            <InsightCard
              icon={PieIcon}
              iconClass="bg-violet-100 text-violet-700"
              label="Top Service Share"
              value={`${data?.insights.topSharePercent ?? 0}%`}
            />
            <InsightCard
              icon={FileText}
              iconClass="bg-rose-100 text-[#7a1f2b]"
              label="Avg Requests / Day"
              value={String(data?.insights.averagePerDay ?? 0)}
            />
          </div>
        </section>
      </div>

      {/* Trend + top divisions */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Monthly Request Trend</h3>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
          ) : (
            <MonthlyTrend data={data?.monthlyTrend ?? []} />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Top Requesting Divisions / Sections
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-semibold">#</th>
                  <th className="pb-2 font-semibold">Division / Section</th>
                  <th className="pb-2 text-right font-semibold">Requests</th>
                  <th className="pb-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topDivisions ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No data yet
                    </td>
                  </tr>
                ) : (
                  (data?.topDivisions ?? []).map((row, i) => (
                    <tr key={row.name} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 text-slate-400">{i + 1}</td>
                      <td className="py-2.5 font-medium text-slate-800">{row.name}</td>
                      <td className="py-2.5 text-right text-slate-700">{row.count}</td>
                      <td className="py-2.5 text-right text-slate-500">{row.percent}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* My Forms list */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">My Forms</h3>
          <ActionLink to={ADMIN_FORMS}>+ New Form</ActionLink>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading forms…</p>
        ) : forms.length === 0 ? (
          <EmptyState
            title="No forms available."
            description="Create your first form to start accepting requests."
            action={<ActionLink to={ADMIN_FORMS}>Create Form</ActionLink>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {forms.map((f) => {
              const canSubmit = f.status === "draft" || f.status === "disapproved";
              const showChart = chartFormId === f._id;
              const trend = f.monthlyTrend ?? [];
              return (
                <article
                  key={f._id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/40 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate font-semibold text-slate-900">{f.title}</h4>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">{f.refNumber}</p>
                    </div>
                    <FormStatusBadge status={f.status as FormStatus} />
                  </div>

                  <div className="mt-auto space-y-1 text-xs text-slate-500">
                    <p>
                      <span className="font-medium text-slate-700">{f.requestCount}</span> requests
                    </p>
                    <p>
                      Last submission:{" "}
                      {f.lastSubmissionAt
                        ? new Date(f.lastSubmissionAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>

                  {showChart ? (
                    <div className="mt-3 h-28 rounded-lg border border-slate-200 bg-white p-2">
                      <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Requests (12 mo)
                      </p>
                      <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={2} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 9 }} width={28} />
                          <Tooltip />
                          <Bar dataKey="count" fill={MAROON} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}

                  {f.status === "disapproved" && f.reviewRemarks ? (
                    <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs leading-relaxed text-destructive">
                      {f.reviewRemarks}
                    </p>
                  ) : null}

                  <div className="mt-3 flex items-center gap-2 border-t border-slate-200/80 pt-3">
                    {canSubmit ? (
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => submit.mutate(f._id)}
                        disabled={submit.isPending}
                      >
                        {f.status === "disapproved" ? "Resubmit" : "Send to Records"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          setViewForm({
                            id: f._id,
                            title: f.title,
                            refNumber: f.refNumber,
                          })
                        }
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-8 text-slate-500"
                      onClick={() => setChartFormId(showChart ? null : f._id)}
                      aria-label={showChart ? "Hide chart" : "Show chart"}
                    >
                      <PieIcon className="mr-1.5 h-3.5 w-3.5" />
                      {showChart ? "Hide chart" : "Chart"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <AdminFormViewerDialog
        formId={viewForm?.id ?? null}
        formTitle={viewForm?.title}
        refNumber={viewForm?.refNumber}
        open={Boolean(viewForm)}
        onOpenChange={(open) => {
          if (!open) setViewForm(null);
        }}
      />
    </div>
  );
}
