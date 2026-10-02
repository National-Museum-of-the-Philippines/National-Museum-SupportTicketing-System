import { useEffect, useState } from "react";
import { ajax } from "@/lib/ajax";
import { apiBase } from "@/lib/api-base";

const API_BASE = apiBase();

export type ApiHealthStatus = "checking" | "ok" | "down";

export function useApiHealth() {
  const [status, setStatus] = useState<ApiHealthStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await ajax(`${API_BASE}/api/health`, {
          timeoutMs: 4000,
          signal: AbortSignal.timeout(4000),
          headers: { Accept: "application/json" },
        });
        if (!cancelled) setStatus(res.ok ? "ok" : "down");
      } catch {
        if (!cancelled) setStatus("down");
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
