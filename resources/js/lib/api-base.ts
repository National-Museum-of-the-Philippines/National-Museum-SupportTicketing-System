/** API origin from `VITE_API_URL`. Empty means same-origin `/api` requests. */
export function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured !== "string") return "";
  return configured.trim().replace(/\/$/, "");
}
