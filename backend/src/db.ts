import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = createPool({
      host: config.mysqlHost,
      port: config.mysqlPort,
      user: config.mysqlUser,
      password: config.mysqlPassword,
      database: config.mysqlDatabase,
      waitForConnections: true,
      connectionLimit: 20,
      namedPlaceholders: true,
      timezone: "Z",
      dateStrings: false,
    });
  }
  return pool;
}

type SqlParams = Record<string, unknown> | unknown[] | undefined;

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: SqlParams,
): Promise<T> {
  const [rows] = await getPool().query<T>(sql, params as never);
  return rows;
}

export async function execute(
  sql: string,
  params?: SqlParams,
): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params as never);
  return result;
}

export async function connectDb() {
  const p = getPool();
  await p.query("SELECT 1");
  const schemaPath = path.join(__dirname, "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  for (const statement of schemaSql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    await p.query(statement);
  }
  console.log("MySQL connected");
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
