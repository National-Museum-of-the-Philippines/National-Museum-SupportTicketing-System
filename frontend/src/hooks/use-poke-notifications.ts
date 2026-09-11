import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { PokeRecord } from "@/lib/api/types";
import type { NotificationItem } from "@/lib/notifications";
import { pokesToNotifications, subscribePokeNotifications } from "@/lib/poke-notifications";
import type { PortalSlot } from "@/lib/sessions";

export function usePokeNotifications(slot: PortalSlot, enabled = true): NotificationItem[] {
  const [livePokes, setLivePokes] = useState<PokeRecord[]>([]);

  const { data } = useQuery({
    queryKey: ["recent-pokes", slot],
    queryFn: () => api.listRecentPokes(slot),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (!enabled) return;
    return subscribePokeNotifications((eventSlot, poke) => {
      if (eventSlot !== slot) return;
      setLivePokes((prev) => {
        if (prev.some((p) => p._id === poke._id)) return prev;
        return [poke, ...prev].slice(0, 8);
      });
    });
  }, [slot, enabled]);

  return useMemo(() => {
    const seen = new Set<string>();
    const merged: PokeRecord[] = [];
    for (const poke of [...livePokes, ...(data?.items ?? [])]) {
      if (seen.has(poke._id)) continue;
      seen.add(poke._id);
      merged.push(poke);
    }
    return pokesToNotifications(slot, merged);
  }, [livePokes, data?.items, slot]);
}
