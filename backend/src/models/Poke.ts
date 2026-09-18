import type { RowDataPacket } from "mysql2";
import { query, execute } from "../db.js";
import { newId } from "../utils/ids.js";
import { asDateRequired } from "../utils/sqlJson.js";

export type PokeDoc = {
  _id: string;
  fromUserId: string | { _id: string; name?: string; role?: string };
  toUserId: string;
  conversationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PokeRow = RowDataPacket & {
  id: string;
  from_user_id: string;
  to_user_id: string;
  conversation_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  from_name?: string;
  from_role?: string;
};

export type PokeFilter = {
  fromUserId?: string;
  toUserId?: string;
  createdAt?: { $gte?: Date };
};

export type PokeFindOptions = {
  sort?: Record<string, 1 | -1>;
  limit?: number;
  populate?: string | string[];
};

function mapRow(row: PokeRow, populateFrom = false): PokeDoc {
  return {
    _id: row.id,
    fromUserId: populateFrom
      ? {
          _id: row.from_user_id,
          name: row.from_name,
          role: row.from_role,
        }
      : row.from_user_id,
    toUserId: row.to_user_id,
    conversationId: row.conversation_id,
    createdAt: asDateRequired(row.created_at),
    updatedAt: asDateRequired(row.updated_at),
  };
}

function wantsPopulateFrom(populate?: string | string[]): boolean {
  if (!populate) return false;
  const list = Array.isArray(populate) ? populate : [populate];
  return list.some((p) => p === "fromUserId" || p.startsWith("fromUserId"));
}

function buildWhere(filter: PokeFilter = {}): { sql: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.fromUserId !== undefined) {
    clauses.push("p.from_user_id = :fromUserId");
    params.fromUserId = filter.fromUserId;
  }
  if (filter.toUserId !== undefined) {
    clauses.push("p.to_user_id = :toUserId");
    params.toUserId = filter.toUserId;
  }
  if (filter.createdAt?.$gte) {
    clauses.push("p.created_at >= :createdGte");
    params.createdGte = filter.createdAt.$gte;
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function buildOrder(sort?: Record<string, 1 | -1>): string {
  if (!sort || Object.keys(sort).length === 0) return "ORDER BY p.created_at DESC";
  const colMap: Record<string, string> = {
    createdAt: "p.created_at",
    updatedAt: "p.updated_at",
  };
  const parts = Object.entries(sort).map(([key, dir]) => {
    const col = colMap[key] ?? `p.${key}`;
    return `${col} ${dir === -1 ? "DESC" : "ASC"}`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}

export const Poke = {
  async findOne(filter: PokeFilter, options: PokeFindOptions = {}): Promise<PokeDoc | null> {
    const items = await Poke.find(filter, { ...options, limit: 1 });
    return items[0] ?? null;
  },

  async find(filter: PokeFilter = {}, options: PokeFindOptions = {}): Promise<PokeDoc[]> {
    const { sql, params } = buildWhere(filter);
    const populateFrom = wantsPopulateFrom(options.populate);
    const join = populateFrom ? "LEFT JOIN users u ON u.id = p.from_user_id" : "";
    const selectExtra = populateFrom ? ", u.name AS from_name, u.role AS from_role" : "";
    const order = buildOrder(options.sort);
    let limitSql = "";
    if (options.limit != null) limitSql = `LIMIT ${Number(options.limit)}`;

    const rows = await query<PokeRow[]>(
      `SELECT p.*${selectExtra} FROM pokes p ${join} ${sql} ${order} ${limitSql}`.trim(),
      params,
    );
    return rows.map((row) => mapRow(row, populateFrom));
  },

  async create(data: {
    fromUserId: string;
    toUserId: string;
    conversationId?: string | null;
  }): Promise<PokeDoc> {
    const id = newId();
    await execute(
      `INSERT INTO pokes (id, from_user_id, to_user_id, conversation_id)
       VALUES (:id, :fromUserId, :toUserId, :conversationId)`,
      {
        id,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        conversationId: data.conversationId ?? null,
      },
    );
    const items = await Poke.find({ fromUserId: data.fromUserId, toUserId: data.toUserId }, { limit: 1, sort: { createdAt: -1 } });
    const doc = items.find((p) => p._id === id) ?? items[0];
    if (!doc) throw new Error("Failed to create poke");
    return doc;
  },
};
