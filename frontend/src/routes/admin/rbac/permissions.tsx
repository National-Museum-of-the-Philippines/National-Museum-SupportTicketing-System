import { createFileRoute, redirect } from "@tanstack/react-router";
import { ADMIN_DASHBOARD } from "@/lib/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { KeyRound, Layers3, Search, Shield } from "lucide-react";
import { formatRoleLabel, RbacShell, RbacSummaryCard } from "@/components/rbac/rbac-ui";
import {
  DataPanel,
  EmptyState,
  FlowNotice,
  LoadingRows,
} from "@/components/layout/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";
import type { RbacPermission } from "@/lib/api/types";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/admin/rbac/permissions")({
  beforeLoad: () => {
    throw redirect({ to: ADMIN_DASHBOARD, replace: true });
  },
  component: RbacPermissionsPage,
});

function groupPermissions(permissions: RbacPermission[]) {
  const map = new Map<string, RbacPermission[]>();
  for (const perm of permissions) {
    const key = perm.category || "General";
    const list = map.get(key) ?? [];
    list.push(perm);
    map.set(key, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function RbacPermissionsPage() {
  const { canQuery } = useAdminSession();
  const [search, setSearch] = useState("");

  const permissionsQuery = useQuery({
    queryKey: ["rbac-permissions"],
    queryFn: () => api.rbacPermissions(),
    enabled: canQuery,
  });

  const permissions = permissionsQuery.data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [permissions, search]);

  const grouped = useMemo(() => groupPermissions(filtered), [filtered]);
  const categoryCount = useMemo(() => {
    const set = new Set(permissions.map((p) => p.category || "General"));
    return set.size;
  }, [permissions]);

  const ticketingCount = permissions.filter((p) =>
    (p.category ?? "").toLowerCase().startsWith("ticketing"),
  ).length;

  const errorMessage =
    permissionsQuery.error instanceof ApiError
      ? permissionsQuery.error.message
      : permissionsQuery.error instanceof Error
        ? permissionsQuery.error.message
        : "Could not load permissions.";

  return (
    <RbacShell
      section="permissions"
      title="Permissions"
      description="Capabilities available in the system, grouped by category. Assign them to roles from the Roles page."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <RbacSummaryCard
          icon={KeyRound}
          iconClass="bg-sky-50 text-sky-600"
          label="Total permissions"
          value={permissions.length}
          loading={permissionsQuery.isLoading}
        />
        <RbacSummaryCard
          icon={Shield}
          iconClass="bg-emerald-50 text-emerald-600"
          label="Ticketing permissions"
          value={ticketingCount}
          loading={permissionsQuery.isLoading}
        />
        <RbacSummaryCard
          icon={Layers3}
          iconClass="bg-amber-50 text-amber-600"
          label="Categories"
          value={categoryCount}
          loading={permissionsQuery.isLoading}
        />
      </div>

      <DataPanel
        title="Permission catalog"
        description={
          filtered.length === permissions.length
            ? "Seeded from current Support Ticketing System capabilities"
            : `${filtered.length} of ${permissions.length} shown`
        }
      >
        <div className="relative mb-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permissions…"
            className="pl-9"
          />
        </div>

        {permissionsQuery.isError ? (
          <FlowNotice
            tone="danger"
            title="Could not load permissions"
            action={
              <Button variant="outline" size="sm" onClick={() => void permissionsQuery.refetch()}>
                Retry
              </Button>
            }
          >
            {errorMessage}
          </FlowNotice>
        ) : permissionsQuery.isLoading ? (
          <LoadingRows rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No permissions found"
            description="Try a different search."
            action={
              search ? (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([category, perms]) => (
              <div key={category} className="overflow-hidden rounded-xl border border-border/80">
                <div className="flex items-center gap-2 border-b border-border/60 bg-slate-50 px-4 py-2.5">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                  <span className="text-xs text-muted-foreground">{perms.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Permission</th>
                        <th>Key</th>
                        <th>Roles using</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perms.map((perm) => (
                        <tr key={perm.id}>
                          <td className="font-medium text-foreground">
                            {perm.description || formatRoleLabel(perm.name)}
                          </td>
                          <td>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                              {perm.name}
                            </span>
                          </td>
                          <td className="tabular-nums">{perm.roleCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataPanel>
    </RbacShell>
  );
}
