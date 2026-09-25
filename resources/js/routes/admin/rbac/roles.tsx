import { createFileRoute, redirect } from "@tanstack/react-router";
import { ADMIN_DASHBOARD } from "@/lib/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatRoleLabel, RbacShell, RbacSummaryCard } from "@/components/rbac/rbac-ui";
import {
  DataPanel,
  EmptyState,
  FlowNotice,
  LoadingRows,
} from "@/components/layout/workspace-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import type { RbacPermission, RbacRole } from "@/lib/api/types";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/rbac/roles")({
  beforeLoad: () => {
    throw redirect({ to: ADMIN_DASHBOARD, replace: true });
  },
  component: RbacRolesPage,
});

const PROTECTED_ROLES = new Set([
  "super_admin",
  "admin",
  "record_management",
  "user",
]);

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

export function RbacRolesPage() {
  const qc = useQueryClient();
  const { canQuery } = useAdminSession();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [manageRole, setManageRole] = useState<RbacRole | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [permSearch, setPermSearch] = useState("");

  const rolesQuery = useQuery({
    queryKey: ["rbac-roles"],
    queryFn: () => api.rbacRoles(),
    enabled: canQuery,
  });

  const permissionsQuery = useQuery({
    queryKey: ["rbac-permissions"],
    queryFn: () => api.rbacPermissions(),
    enabled: canQuery,
  });

  const createMutation = useMutation({
    mutationFn: () => api.rbacCreateRole({ name: newName, description: newDescription || undefined }),
    onSuccess: () => {
      toast.success("Role created");
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      void qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not create role.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!manageRole) throw new Error("No role selected");
      await api.rbacUpdateRole(manageRole.id, { description: editDescription });
      return api.rbacSyncRolePermissions(manageRole.id, selectedPermissionIds);
    },
    onSuccess: () => {
      toast.success("Role permissions saved");
      setManageRole(null);
      setPermSearch("");
      void qc.invalidateQueries({ queryKey: ["rbac-roles"] });
      void qc.invalidateQueries({ queryKey: ["rbac-permissions"] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not save role.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: number) => api.rbacDeleteRole(roleId),
    onSuccess: () => {
      toast.success("Role deleted");
      void qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not delete role.");
    },
  });

  const roles = rolesQuery.data?.items ?? [];
  const permissions = permissionsQuery.data?.items ?? [];
  const filteredPermissions = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [permissions, permSearch]);
  const grouped = useMemo(() => groupPermissions(filteredPermissions), [filteredPermissions]);

  const totalUsers = roles.reduce((sum, role) => sum + (role.userCount ?? 0), 0);
  const customRoles = roles.filter((role) => !PROTECTED_ROLES.has(role.name)).length;

  const errorMessage =
    rolesQuery.error instanceof ApiError
      ? rolesQuery.error.message
      : rolesQuery.error instanceof Error
        ? rolesQuery.error.message
        : "Could not load roles.";

  function openManage(role: RbacRole) {
    setManageRole(role);
    setSelectedPermissionIds(role.permissionIds ?? []);
    setEditDescription(role.description ?? "");
    setPermSearch("");
  }

  function togglePermission(id: number) {
    setSelectedPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCategory(categoryPerms: RbacPermission[], checked: boolean) {
    const ids = categoryPerms.map((p) => p.id);
    setSelectedPermissionIds((prev) => {
      if (checked) return [...new Set([...prev, ...ids])];
      return prev.filter((id) => !ids.includes(id));
    });
  }

  return (
    <RbacShell
      section="roles"
      title="Roles"
      description="Manage system roles and the permissions granted to each role."
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New role
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <RbacSummaryCard
          icon={Shield}
          iconClass="bg-sky-50 text-sky-600"
          label="Roles"
          value={roles.length}
          loading={rolesQuery.isLoading}
        />
        <RbacSummaryCard
          icon={Shield}
          iconClass="bg-emerald-50 text-emerald-600"
          label="Custom roles"
          value={customRoles}
          loading={rolesQuery.isLoading}
        />
        <RbacSummaryCard
          icon={Shield}
          iconClass="bg-amber-50 text-amber-600"
          label="Role assignments"
          value={totalUsers}
          loading={rolesQuery.isLoading}
        />
      </div>

      <DataPanel title="System roles" description={`${roles.length} roles`}>
        {rolesQuery.isError ? (
          <FlowNotice
            tone="danger"
            title="Could not load roles"
            action={
              <Button variant="outline" size="sm" onClick={() => void rolesQuery.refetch()}>
                Retry
              </Button>
            }
          >
            {errorMessage}
          </FlowNotice>
        ) : rolesQuery.isLoading ? (
          <LoadingRows rows={5} />
        ) : roles.length === 0 ? (
          <EmptyState title="No roles yet" description="Create a role to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Role</th>
                  <th className="text-left">Permissions</th>
                  <th className="text-left">Users</th>
                  <th className="w-[1%] whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const protectedRole = PROTECTED_ROLES.has(role.name);
                  return (
                    <tr key={role.id}>
                      <td>
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <Shield className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-semibold text-foreground">
                              {formatRoleLabel(role.name)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {role.description || (
                                <span className="font-mono text-xs">{role.name}</span>
                              )}
                            </p>
                            {protectedRole ? (
                              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                System role
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="font-medium tabular-nums text-foreground">
                        {role.permissionCount ?? 0}
                      </td>
                      <td className="font-medium tabular-nums text-foreground">
                        {role.userCount ?? 0}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openManage(role)}>
                            Manage
                          </Button>
                          {!protectedRole ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              disabled={deleteMutation.isPending}
                              onClick={() => {
                                if (confirm(`Delete role “${formatRoleLabel(role.name)}”?`)) {
                                  deleteMutation.mutate(role.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>
              Use a short snake_case name. Attach permissions after creating the role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                placeholder="e.g. form_reviewer"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                placeholder="Short description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manageRole !== null}
        onOpenChange={(open) => {
          if (!open) {
            setManageRole(null);
            setPermSearch("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Manage {manageRole ? formatRoleLabel(manageRole.name) : "role"}
            </DialogTitle>
            <DialogDescription>
              Update the description and choose which permissions this role grants.
            </DialogDescription>
          </DialogHeader>
          {manageRole ? (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Input
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Permissions</Label>
                    <span className="text-xs text-muted-foreground">
                      {selectedPermissionIds.length} selected
                    </span>
                  </div>
                  <Input
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    placeholder="Filter permissions…"
                    className="sm:max-w-xs"
                  />
                </div>
                {grouped.map(([category, perms]) => {
                  const allChecked = perms.every((p) => selectedPermissionIds.includes(p.id));
                  const someChecked = perms.some((p) => selectedPermissionIds.includes(p.id));
                  return (
                    <div key={category} className="rounded-lg border border-border/80">
                      <label className="flex cursor-pointer items-center gap-2 border-b border-border/60 bg-slate-50 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = !allChecked && someChecked;
                          }}
                          onChange={(e) => toggleCategory(perms, e.target.checked)}
                        />
                        <span className="text-sm font-semibold text-foreground">{category}</span>
                      </label>
                      <div className="divide-y divide-border/50">
                        {perms.map((perm) => {
                          const checked = selectedPermissionIds.includes(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/50",
                                checked && "bg-emerald-50/50",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={checked}
                                onChange={() => togglePermission(perm.id)}
                              />
                              <span>
                                <span className="block text-sm font-medium text-foreground">
                                  {perm.description || formatRoleLabel(perm.name)}
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {perm.name}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManageRole(null)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !manageRole}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RbacShell>
  );
}
