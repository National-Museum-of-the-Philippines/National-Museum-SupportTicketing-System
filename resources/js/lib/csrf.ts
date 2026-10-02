import { apiBase } from "@/lib/api-base";
import { ajax } from "@/lib/ajax";

const API_BASE = apiBase();

const META_NAME = "csrf-token";

let token = "";

export function csrfToken(): string {
  if (token) return token;
  if (typeof document === "undefined") return "";
  return document.querySelector(`meta[name="${META_NAME}"]`)?.getAttribute("content") ?? "";
}

function writeMeta(value: string) {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", META_NAME);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", value);
}

export function setCsrfToken(value: string) {
  token = value;
  writeMeta(value);
}

/** Load Laravel's session CSRF token into the layout meta tag. */
export async function loadCsrfToken(): Promise<void> {
  try {
    const res = await ajax(`${API_BASE}/api/csrf-token`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    const body = (await res.json()) as { token?: string };
    if (body.token) setCsrfToken(body.token);
  } catch {
    // The app still runs if the token endpoint is unavailable.
  }
}
