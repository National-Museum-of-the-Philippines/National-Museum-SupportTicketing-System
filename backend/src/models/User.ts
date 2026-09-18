import type { RowDataPacket } from "mysql2";
import { query, execute } from "../db.js";
import type { Role } from "../constants.js";
import { newId } from "../utils/ids.js";
import { asBool, asDateRequired } from "../utils/sqlJson.js";

export type UserDoc = {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  division: string;
  designation: string;
  role: Role | string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<UserDoc>;
};

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  division: string;
  designation?: string | null;
  role: string;
  active: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type UserFilter = {
  _id?: string | { $in?: string[]; $ne?: string };
  email?: string;
  role?: string | { $ne?: string };
  active?: boolean;
};

export type UserFindOptions = {
  sort?: Record<string, 1 | -1>;
  select?: string;
  skip?: number;
  limit?: number;
};

function mapRow(row: UserRow): UserDoc {
  const doc: UserDoc = {
    _id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    division: row.division,
    designation: row.designation ?? "",
    role: row.role,
    active: asBool(row.active),
    createdAt: asDateRequired(row.created_at),
    updatedAt: asDateRequired(row.updated_at),
    async save() {
      await execute(
        `UPDATE users SET email = :email, password_hash = :passwordHash, name = :name,
         division = :division, designation = :designation, role = :role, active = :active WHERE id = :id`,
        {
          id: doc._id,
          email: doc.email,
          passwordHash: doc.passwordHash,
          name: doc.name,
          division: doc.division,
          designation: doc.designation ?? "",
          role: doc.role,
          active: doc.active ? 1 : 0,
        },
      );
      const fresh = await User.findById(doc._id);
      if (!fresh) throw new Error("User not found after save");
      Object.assign(doc, fresh);
      return doc;
    },
  };
  return doc;
}

function buildWhere(filter: UserFilter = {}): { sql: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter._id !== undefined) {
    if (typeof filter._id === "string") {
      clauses.push("id = :id");
      params.id = filter._id;
    } else if (filter._id.$in) {
      if (filter._id.$in.length === 0) {
        clauses.push("1 = 0");
      } else {
        const placeholders = filter._id.$in.map((_, i) => `:idIn${i}`);
        filter._id.$in.forEach((id, i) => {
          params[`idIn${i}`] = id;
        });
        clauses.push(`id IN (${placeholders.join(", ")})`);
      }
    }
    if (typeof filter._id === "object" && filter._id.$ne !== undefined) {
      clauses.push("id != :idNe");
      params.idNe = filter._id.$ne;
    }
  }

  if (filter.email !== undefined) {
    clauses.push("email = :email");
    params.email = filter.email;
  }

  if (filter.role !== undefined) {
    if (typeof filter.role === "string") {
      clauses.push("role = :role");
      params.role = filter.role;
    } else if (filter.role.$ne !== undefined) {
      clauses.push("role != :roleNe");
      params.roleNe = filter.role.$ne;
    }
  }

  if (filter.active !== undefined) {
    clauses.push("active = :active");
    params.active = filter.active ? 1 : 0;
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function buildOrder(sort?: Record<string, 1 | -1>): string {
  if (!sort || Object.keys(sort).length === 0) return "";
  const colMap: Record<string, string> = {
    name: "name",
    role: "role",
    email: "email",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  const parts = Object.entries(sort).map(([key, dir]) => {
    const col = colMap[key] ?? key;
    return `${col} ${dir === -1 ? "DESC" : "ASC"}`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}

export const User = {
  async findById(id: string): Promise<UserDoc | null> {
    const rows = await query<UserRow[]>("SELECT * FROM users WHERE id = :id LIMIT 1", { id });
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async findOne(filter: UserFilter): Promise<UserDoc | null> {
    const { sql, params } = buildWhere(filter);
    const rows = await query<UserRow[]>(`SELECT * FROM users ${sql} LIMIT 1`, params);
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async find(filter: UserFilter = {}, options: UserFindOptions = {}): Promise<UserDoc[]> {
    const { sql, params } = buildWhere(filter);
    const order = buildOrder(options.sort);
    let limitSql = "";
    if (options.limit != null) {
      limitSql = `LIMIT ${Number(options.limit)}`;
      if (options.skip != null) {
        limitSql = `LIMIT ${Number(options.skip)}, ${Number(options.limit)}`;
      }
    } else if (options.skip != null) {
      limitSql = `LIMIT ${Number(options.skip)}, 18446744073709551615`;
    }
    const rows = await query<UserRow[]>(
      `SELECT * FROM users ${sql} ${order} ${limitSql}`.trim(),
      params,
    );
    return rows.map(mapRow);
  },

  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
    division?: string;
    designation?: string;
    role?: string;
    active?: boolean;
    password?: string;
  }): Promise<UserDoc> {
    const id = newId();
    await execute(
      `INSERT INTO users (id, email, password_hash, name, division, designation, role, active)
       VALUES (:id, :email, :passwordHash, :name, :division, :designation, :role, :active)`,
      {
        id,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
        division: data.division ?? "ICT",
        designation: data.designation ?? "",
        role: data.role ?? "user",
        active: data.active === false ? 0 : 1,
      },
    );
    const doc = await User.findById(id);
    if (!doc) throw new Error("Failed to create user");
    return doc;
  },

  async deleteMany(filter: UserFilter): Promise<void> {
    const { sql, params } = buildWhere(filter);
    if (!sql) return;
    await execute(`DELETE FROM users ${sql}`, params);
  },
};
