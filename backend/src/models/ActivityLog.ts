import type { RowDataPacket } from "mysql2";
import { query, execute } from "../db.js";
import { newId } from "../utils/ids.js";
import { asDateRequired, parseJson, toJson } from "../utils/sqlJson.js";

export type ActivityLogDoc = {
  _id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type ActivityRow = RowDataPacket & {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  meta: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ActivityFindOptions = {
  sort?: Record<string, 1 | -1>;
  limit?: number;
};

function mapRow(row: ActivityRow): ActivityLogDoc {
  return {
    _id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    meta: parseJson(row.meta, {}),
    createdAt: asDateRequired(row.created_at),
    updatedAt: asDateRequired(row.updated_at),
  };
}

function buildOrder(sort?: Record<string, 1 | -1>): string {
  if (!sort || Object.keys(sort).length === 0) return "ORDER BY created_at DESC";
  const colMap: Record<string, string> = {
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  const parts = Object.entries(sort).map(([key, dir]) => {
    const col = colMap[key] ?? key;
    return `${col} ${dir === -1 ? "DESC" : "ASC"}`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}

export const ActivityLog = {
  async find(_filter: Record<string, unknown> = {}, options: ActivityFindOptions = {}): Promise<ActivityLogDoc[]> {
    const order = buildOrder(options.sort);
    let limitSql = "";
    if (options.limit != null) limitSql = `LIMIT ${Number(options.limit)}`;
    const rows = await query<ActivityRow[]>(
      `SELECT * FROM activity_logs ${order} ${limitSql}`.trim(),
    );
    return rows.map(mapRow);
  },

  async create(data: {
    actorId?: string | null;
    actorName?: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    meta?: Record<string, unknown>;
  }): Promise<ActivityLogDoc> {
    const id = newId();
    await execute(
      `INSERT INTO activity_logs (
        id, actor_id, actor_name, action, entity_type, entity_id, summary, meta
      ) VALUES (
        :id, :actorId, :actorName, :action, :entityType, :entityId, :summary, CAST(:meta AS JSON)
      )`,
      {
        id,
        actorId: data.actorId ?? null,
        actorName: data.actorName ?? "System",
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        summary: data.summary,
        meta: toJson(data.meta ?? {}),
      },
    );
    const rows = await query<ActivityRow[]>(
      "SELECT * FROM activity_logs WHERE id = :id LIMIT 1",
      { id },
    );
    if (!rows[0]) throw new Error("Failed to create activity log");
    return mapRow(rows[0]);
  },
};
