import type { RowDataPacket } from "mysql2";
import type { AuthUser } from "../middleware/auth.js";
import { Form } from "../models/Form.js";
import { query } from "../db.js";

export type NamedCount = {
  name: string;
  count: number;
  percent: number;
};

export type MyFormsAnalytics = {
  rangeLabel: string;
  summary: {
    totalRequests: number;
    totalRequestsChangePct: number | null;
    totalDivisions: number;
    divisionsChangePct: number | null;
    mostRequestedService: string;
    mostRequestedCount: number;
    mostRequestedPercent: number;
    requestsThisMonth: number;
    requestsThisMonthChangePct: number | null;
  };
  byDivision: NamedCount[];
  byService: NamedCount[];
  monthlyTrend: Array<{ month: string; monthKey: string; count: number }>;
  insights: {
    mostActiveDivision: string;
    mostRequestedService: string;
    fastestGrowing: string;
    topSharePercent: number;
    averagePerDay: number;
  };
  topDivisions: NamedCount[];
  forms: Array<{
    _id: string;
    title: string;
    refNumber: string;
    status: string;
    requestCount: number;
    lastSubmissionAt: string | null;
    updatedAt: string;
    reviewRemarks?: string;
  }>;
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function monthBuckets(months = 12) {
  const buckets: Array<{ monthKey: string; month: string; start: Date }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      month: start.toLocaleString("en-US", { month: "short" }),
      start,
    });
  }
  return buckets;
}

function toNamedCounts(
  rows: Array<{ name: string; count: number }>,
  total: number,
  limit = 8,
): NamedCount[] {
  return rows.slice(0, limit).map((row) => ({
    name: row.name?.trim() || "Unspecified",
    count: row.count,
    percent: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0,
  }));
}

function formIdPlaceholders(formIds: string[], params: Record<string, unknown>): string {
  return formIds
    .map((id, i) => {
      params[`fid${i}`] = id;
      return `:fid${i}`;
    })
    .join(", ");
}

export async function getMyFormsAnalytics(user: AuthUser): Promise<MyFormsAnalytics> {
  const forms = await Form.find({ createdBy: user.id }, { sort: { updatedAt: -1 } });
  const formIds = forms.map((f) => f._id);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const buckets = monthBuckets(12);
  const rangeStart = buckets[0]!.start;

  if (formIds.length === 0) {
    const rangeLabel = `${thisMonthStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} – ${now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
    return {
      rangeLabel,
      summary: {
        totalRequests: 0,
        totalRequestsChangePct: null,
        totalDivisions: 0,
        divisionsChangePct: null,
        mostRequestedService: "—",
        mostRequestedCount: 0,
        mostRequestedPercent: 0,
        requestsThisMonth: 0,
        requestsThisMonthChangePct: null,
      },
      byDivision: [],
      byService: [],
      monthlyTrend: buckets.map((b) => ({ month: b.month, monthKey: b.monthKey, count: 0 })),
      insights: {
        mostActiveDivision: "—",
        mostRequestedService: "—",
        fastestGrowing: "—",
        topSharePercent: 0,
        averagePerDay: 0,
      },
      topDivisions: [],
      forms: forms.map((f) => ({
        _id: f._id,
        title: f.title,
        refNumber: f.refNumber,
        status: f.status,
        requestCount: 0,
        lastSubmissionAt: null,
        updatedAt: f.updatedAt.toISOString(),
        reviewRemarks: f.reviewRemarks || undefined,
      })),
    };
  }

  const baseParams: Record<string, unknown> = {};
  const inList = formIdPlaceholders(formIds, baseParams);
  const formMatch = `form_id IN (${inList})`;

  const [
    totalRows,
    thisMonthRows,
    lastMonthRows,
    divisionRows,
    serviceRows,
    monthlyRows,
    thisMonthDivRows,
    lastMonthDivRows,
    ticketsByForm,
    lastSubmissions,
    thisMonthServices,
    lastMonthServices,
  ] = await Promise.all([
    query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM tickets WHERE ${formMatch}`, baseParams),
    query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM tickets WHERE ${formMatch} AND created_at >= :thisMonthStart`,
      { ...baseParams, thisMonthStart },
    ),
    query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM tickets WHERE ${formMatch} AND created_at >= :lastMonthStart AND created_at < :thisMonthStart`,
      { ...baseParams, lastMonthStart, thisMonthStart },
    ),
    query<RowDataPacket[]>(
      `SELECT COALESCE(NULLIF(TRIM(division), ''), 'Unspecified') AS name, COUNT(*) AS count
       FROM tickets WHERE ${formMatch}
       GROUP BY name ORDER BY count DESC`,
      baseParams,
    ),
    query<RowDataPacket[]>(
      `SELECT COALESCE(NULLIF(TRIM(form_title), ''), 'Other') AS name, COUNT(*) AS count
       FROM tickets WHERE ${formMatch}
       GROUP BY name ORDER BY count DESC`,
      baseParams,
    ),
    query<RowDataPacket[]>(
      `SELECT YEAR(created_at) AS year, MONTH(created_at) AS month, COUNT(*) AS count
       FROM tickets WHERE ${formMatch} AND created_at >= :rangeStart
       GROUP BY YEAR(created_at), MONTH(created_at)`,
      { ...baseParams, rangeStart },
    ),
    query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM (
         SELECT COALESCE(NULLIF(TRIM(division), ''), 'Unspecified') AS d
         FROM tickets WHERE ${formMatch} AND created_at >= :thisMonthStart
         GROUP BY d
       ) x`,
      { ...baseParams, thisMonthStart },
    ),
    query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM (
         SELECT COALESCE(NULLIF(TRIM(division), ''), 'Unspecified') AS d
         FROM tickets WHERE ${formMatch} AND created_at >= :lastMonthStart AND created_at < :thisMonthStart
         GROUP BY d
       ) x`,
      { ...baseParams, lastMonthStart, thisMonthStart },
    ),
    query<RowDataPacket[]>(
      `SELECT form_id AS id, COUNT(*) AS count FROM tickets WHERE ${formMatch} GROUP BY form_id`,
      baseParams,
    ),
    query<RowDataPacket[]>(
      `SELECT form_id AS id, MAX(created_at) AS lastAt FROM tickets WHERE ${formMatch} GROUP BY form_id`,
      baseParams,
    ),
    query<RowDataPacket[]>(
      `SELECT COALESCE(NULLIF(TRIM(form_title), ''), 'Other') AS name, COUNT(*) AS count
       FROM tickets WHERE ${formMatch} AND created_at >= :thisMonthStart
       GROUP BY name`,
      { ...baseParams, thisMonthStart },
    ),
    query<RowDataPacket[]>(
      `SELECT COALESCE(NULLIF(TRIM(form_title), ''), 'Other') AS name, COUNT(*) AS count
       FROM tickets WHERE ${formMatch} AND created_at >= :lastMonthStart AND created_at < :thisMonthStart
       GROUP BY name`,
      { ...baseParams, lastMonthStart, thisMonthStart },
    ),
  ]);

  const totalRequests = Number(totalRows[0]?.cnt ?? 0);
  const thisMonthCount = Number(thisMonthRows[0]?.cnt ?? 0);
  const lastMonthCount = Number(lastMonthRows[0]?.cnt ?? 0);

  const divisionNamed = divisionRows.map((r) => ({
    name: String(r.name),
    count: Number(r.count),
  }));
  const serviceNamed = serviceRows.map((r) => ({
    name: String(r.name),
    count: Number(r.count),
  }));

  const byDivision = toNamedCounts(divisionNamed, totalRequests, 8);
  const byService = toNamedCounts(serviceNamed, totalRequests, 6);
  const topDivisions = toNamedCounts(divisionNamed, totalRequests, 5);

  const monthlyMap = new Map(
    monthlyRows.map((row) => [
      `${row.year}-${String(row.month).padStart(2, "0")}`,
      Number(row.count),
    ]),
  );
  const monthlyTrend = buckets.map((b) => ({
    month: b.month,
    monthKey: b.monthKey,
    count: monthlyMap.get(b.monthKey) ?? 0,
  }));

  const countByForm = new Map(ticketsByForm.map((r) => [String(r.id), Number(r.count)]));
  const lastByForm = new Map(
    lastSubmissions.map((r) => [String(r.id), r.lastAt ? new Date(r.lastAt as string | Date) : null]),
  );

  const topService = byService[0];
  const topDivision = byDivision[0];
  const daysInMonth = Math.max(1, now.getDate());
  const averagePerDay = Math.round((thisMonthCount / daysInMonth) * 10) / 10;

  const lastMap = new Map(lastMonthServices.map((r) => [String(r.name), Number(r.count)]));
  let fastestGrowing = topService?.name ?? "—";
  let bestGrowth = -Infinity;
  for (const row of thisMonthServices) {
    const name = String(row.name);
    const prev = lastMap.get(name) ?? 0;
    const growth = Number(row.count) - prev;
    if (growth > bestGrowth) {
      bestGrowth = growth;
      fastestGrowing = name || "—";
    }
  }

  const rangeLabel = `${thisMonthStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} – ${now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return {
    rangeLabel,
    summary: {
      totalRequests,
      totalRequestsChangePct: pctChange(thisMonthCount, lastMonthCount),
      totalDivisions: divisionNamed.length,
      divisionsChangePct: pctChange(
        Number(thisMonthDivRows[0]?.count ?? 0),
        Number(lastMonthDivRows[0]?.count ?? 0),
      ),
      mostRequestedService: topService?.name ?? "—",
      mostRequestedCount: topService?.count ?? 0,
      mostRequestedPercent: topService?.percent ?? 0,
      requestsThisMonth: thisMonthCount,
      requestsThisMonthChangePct: pctChange(thisMonthCount, lastMonthCount),
    },
    byDivision,
    byService,
    monthlyTrend,
    insights: {
      mostActiveDivision: topDivision?.name ?? "—",
      mostRequestedService: topService?.name ?? "—",
      fastestGrowing,
      topSharePercent: topService?.percent ?? 0,
      averagePerDay,
    },
    topDivisions,
    forms: forms.map((f) => ({
      _id: String(f._id),
      title: f.title,
      refNumber: f.refNumber,
      status: f.status,
      requestCount: countByForm.get(String(f._id)) ?? 0,
      lastSubmissionAt: lastByForm.get(String(f._id))?.toISOString() ?? null,
      updatedAt: f.updatedAt.toISOString(),
      reviewRemarks: f.reviewRemarks || undefined,
    })),
  };
}
