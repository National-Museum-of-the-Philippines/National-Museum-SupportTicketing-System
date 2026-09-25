const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/** Resolve `/uploads/...` paths against the API host when configured. */
export function resolveMediaUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

export function isPdfPath(path: string): boolean {
  return /\.pdf$/i.test(path) || path.includes("application/pdf");
}

export function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(path);
}
