import { api, ApiError } from "@/lib/api/client";

/**
 * Browser-side feed for Super Admin → Error Monitoring.
 * Server failures are already recorded by Laravel, so ApiError is skipped.
 * Identical messages are reported at most once per minute.
 */
const DEDUPE_MS = 60_000;
const recent = new Map<string, number>();
let installed = false;

function describe(value: unknown): { message: string; stack: string | null } {
  if (value instanceof Error) {
    return { message: `${value.name}: ${value.message}`, stack: value.stack ?? null };
  }
  if (typeof value === "string") return { message: value, stack: null };
  try {
    return { message: JSON.stringify(value), stack: null };
  } catch {
    return { message: String(value), stack: null };
  }
}

export function captureError(error: unknown, kind = "error", component?: string): void {
  if (typeof window === "undefined") return;
  if (error instanceof ApiError) return;

  const { message, stack } = describe(error);
  const text = (message || "Unknown error").slice(0, 2000);
  const key = `${kind}|${text}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  if (recent.size > 200) recent.clear();
  recent.set(key, now);

  void api
    .reportClientError({
      message: text,
      stack: stack ? stack.slice(0, 12000) : null,
      url: window.location.href.slice(0, 2000),
      kind,
      component,
    })
    .catch(() => {
      /* the monitor must never break the page */
    });
}

export function installGlobalErrorReporting(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;

  const onError = (event: ErrorEvent) => {
    captureError(event.error ?? event.message, "window.error");
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    captureError(event.reason, "unhandledrejection");
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}
