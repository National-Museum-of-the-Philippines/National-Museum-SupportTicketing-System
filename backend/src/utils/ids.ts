import { randomBytes } from "node:crypto";

/** 24-char hex id (ObjectId-compatible string shape for API/_id). */
export function newId(): string {
  return randomBytes(12).toString("hex");
}

export const SYSTEM_USER_ID = "000000000000000000000000";

export function idOf(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const obj = value as { _id?: unknown; toString?: () => string };
    if (obj._id != null) return idOf(obj._id);
    if (typeof obj.toString === "function") {
      const s = obj.toString();
      if (s && s !== "[object Object]") return s;
    }
  }
  return String(value);
}
