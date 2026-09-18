export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export function asDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function asDateRequired(value: unknown): Date {
  return asDate(value) ?? new Date();
}
