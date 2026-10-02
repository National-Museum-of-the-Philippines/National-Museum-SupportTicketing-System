import { csrfToken } from "@/lib/csrf";

export type AjaxResult = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  blob: () => Promise<Blob>;
};

type AjaxInit = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function requestBody(body: BodyInit | null | undefined): XMLHttpRequestBodyInit | null {
  if (body == null) return null;
  if (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }
  throw new TypeError("Unsupported AJAX request body");
}

/** XMLHttpRequest call. Sends the layout CSRF token and marks the request as AJAX. */
export function ajax(url: string, init: AjaxInit = {}): Promise<AjaxResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const method = (init.method ?? "GET").toUpperCase();
    xhr.open(method, url, true);
    xhr.responseType = "arraybuffer";
    xhr.withCredentials = init.credentials === "include";
    if (init.timeoutMs) xhr.timeout = init.timeoutMs;

    const headers = new Headers(init.headers);
    headers.set("X-Requested-With", "XMLHttpRequest");
    const token = csrfToken();
    if (token && !headers.has("X-CSRF-TOKEN")) {
      headers.set("X-CSRF-TOKEN", token);
    }
    headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });

    if (init.signal) {
      if (init.signal.aborted) {
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }
      init.signal.addEventListener(
        "abort",
        () => {
          xhr.abort();
        },
        { once: true },
      );
    }

    xhr.onload = () => {
      const bytes = new Uint8Array((xhr.response as ArrayBuffer | null) ?? new ArrayBuffer(0));
      const contentType = (xhr.getResponseHeader("Content-Type") ?? "").split(";")[0] ?? "";
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        json: async () => {
          const text = new TextDecoder().decode(bytes);
          if (!text) return {};
          return JSON.parse(text) as unknown;
        },
        blob: async () => new Blob([bytes], { type: contentType || "application/octet-stream" }),
      });
    };
    xhr.onerror = () => reject(new TypeError("Network request failed"));
    xhr.ontimeout = () => reject(new DOMException("The operation timed out.", "TimeoutError"));
    xhr.onabort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    xhr.send(requestBody(init.body));
  });
}
