import { createFileRoute, redirect } from "@tanstack/react-router";
import { ADMIN_DASHBOARD } from "@/lib/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  avatarTone,
  employeeInitials,
  formatRoleLabel,
  RbacShell,
  RbacSummaryCard,
  RoleChip,
} from "@/components/rbac/rbac-ui";
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
import type { RbacEmployee, RbacRole } from "@/lib/api/types";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/rbac/users")({
  beforeLoad: () => {
    throw redirect({ to: ADMIN_DASHBOARD, replace: true });
  },
  component: RbacUsersPage,
});

export function RbacUsersPage() {
  const qc = useQueryClient();
  const { canQuery } = useAdminSession();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogEmployee, setDialogEmployee] = useState<RbacEmployee | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  useEffect(() => {
    const nextSearch = searchInput.trim();
    const timer = window.setTimeout(() => {
      setSearch(nextSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 only when filters/search actually change — not on every mount tick.
  const filtersKey = `${search}|${roleFilter}|${accessFilter}`;
  const filtersKeyRef = useRef(filtersKey);
  useEffect(() => {
    if (filtersKeyRef.current === filtersKey) return;
    filtersKeyRef.current = filtersKey;
    setPage(1);
  }, [filtersKey]);

  const summaryQuery = useQuery({
    queryKey: ["rbac-summary"],
    queryFn: () => api.rbacSummary(),
    enabled: canQuery,
  });

  const rolesQuery = useQuery({
    queryKey: ["rbac-roles"],
    queryFn: () => api.rbacRoles(),
    enabled: canQuery,
  });

  const employeesQuery = useQuery({
    queryKey: ["rbac-employees", search, roleFilter, accessFilter, page],
    queryFn: () =>
      api.rbacEmployees({
        search: search || undefined,
        role: roleFilter,
        access: accessFilter,
        page,
        perPage: 20,
      }),
    enabled: canQuery,
    placeholderData: (prev) => prev,
  });

  const syncMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      api.rbacSyncRoles(userId, roleIds),
    onSuccess: () => {
      toast.success("Roles updated");
      setDialogEmployee(null);
      void qc.invalidateQueries({ queryKey: ["rbac-employees"] });
      void qc.invalidateQueries({ queryKey: ["rbac-summary"] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not update roles.");
    },
  });

  const roles = rolesQuery.data?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];
  const total = employeesQuery.data?.total ?? 0;
  const from = employeesQuery.data?.from ?? 0;
  const to = employeesQuery.data?.to ?? 0;
  const perPage = employeesQuery.data?.perPage ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const errorMessage =
    employeesQuery.error instanceof ApiError
      ? employeesQuery.error.message
      : employeesQuery.error instanceof Error
        ? employeesQuery.error.message
        : "Could not load employees.";

  function openDialog(employee: RbacEmployee) {
    setDialogEmployee(employee);
    setSelectedRoleIds(employee.roles.map((r) => r.id));
  }

  function toggleRole(roleId: number) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  }

  const dialogTitle = useMemo(() => {
    if (!dialogEmployee) return "Assign roles";
    return dialogEmployee.hasRoles ? "Manage roles" : "Assign roles";
  }, [dialogEmployee]);

  return (
    <RbacShell
      section="users"
      title="Users"
      description="Assign roles to active employees and review access at a glance."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <RbacSummaryCard
          icon={Users}
          iconClass="bg-sky-50 text-sky-600"
          label="Active employees"
          value={summaryQuery.data?.activeEmployees ?? 0}
          loading={summaryQuery.isLoading}
        />
        <RbacSummaryCard
          icon={Shield}
          iconClass="bg-emerald-50 text-emerald-600"
          label="With roles"
          value={summaryQuery.data?.withRoles ?? 0}
          loading={summaryQuery.isLoading}
        />
        <RbacSummaryCard
          icon={ShieldAlert}
          iconClass="bg-amber-50 text-amber-600"
          label="Needs role assignment"
          value={summaryQuery.data?.needsRoleAssignment ?? 0}
          loading={summaryQuery.isLoading}
        />
      </div>

      <DataPanel
        title="Employee access"
        description={
          total > 0 ? `${from}–${to} of ${total.toLocaleString()}` : "No matching employees"
        }
      >
        {/* Same horizontal inset as table cells so Action lines up under All access */}
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, username, email, ID…"
              className="pl-9"
            />
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {formatRoleLabel(role.name)}
                </option>
              ))}
            </select>
            <select
              className="h-10 min-w-[9.5rem] rounded-md border border-input bg-background px-3 text-sm"
              value={accessFilter}
              onChange={(e) => {
                setAccessFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All access</option>
              <option value="assigned">With roles</option>
              <option value="unassigned">Needs assignment</option>
            </select>
          </div>
        </div>

        {employeesQuery.isError ? (
          <div className="px-4 pb-4 sm:px-5">
            <FlowNotice
              tone="danger"
              title="Could not load employees"
              action={
                <Button variant="outline" size="sm" onClick={() => void employeesQuery.refetch()}>
                  Retry
                </Button>
              }
            >
              {errorMessage}
            </FlowNotice>
          </div>
        ) : employeesQuery.isLoading ? (
          <div className="px-4 pb-4 sm:px-5">
            <LoadingRows rows={6} />
          </div>
        ) : employees.length === 0 ? (
          <div className="px-4 pb-4 sm:px-5">
            <EmptyState title="No employees found" description="Try a different search or filter." />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border-t border-border/70">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Employee</th>
                    <th className="text-left">Account</th>
                    <th className="text-left">Assigned roles</th>
                    <th className="w-[1%] whitespace-nowrap text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              avatarTone(employee.username || employee.email),
                            )}
                          >
                            {employeeInitials(employee.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold uppercase tracking-wide text-foreground">
                              {employee.name}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {employee.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                          {employee.username || "—"}
                        </span>
                      </td>
                      <td>
                        {employee.hasRoles ? (
                          <div className="flex flex-wrap gap-1.5">
                            {employee.roles.map((role) => (
                              <RoleChip key={role.id} name={role.name} tone="success" />
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            No roles assigned
                          </span>
                        )}
                      </td>
                      <td className="w-[1%] whitespace-nowrap text-right">
                        {employee.hasRoles ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openDialog(employee)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Manage
                          </Button>
                        ) : (
                          <Button size="sm" className="gap-1.5" onClick={() => openDialog(employee)}>
                            <UserPlus className="h-3.5 w-3.5" />
                            Assign
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3 sm:px-5">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DataPanel>

      <Dialog open={dialogEmployee !== null} onOpenChange={(open) => !open && setDialogEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Select the roles this employee should have for portal access.
            </DialogDescription>
          </DialogHeader>
          {dialogEmployee ? (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-foreground">{dialogEmployee.name}</p>
                <p className="text-sm text-muted-foreground">
                  {dialogEmployee.username} · {dialogEmployee.email}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border/80 p-2">
                  {roles.map((role) => {
                    const checked = selectedRoleIds.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60",
                          checked && "bg-emerald-50/70",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleRole(role.id)}
                        />
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {formatRoleLabel(role.name)}
                          </span>
                          {role.description ? (
                            <span className="block text-xs text-muted-foreground">
                              {role.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogEmployee(null)}
              disabled={syncMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!dialogEmployee) return;
                syncMutation.mutate({
                  userId: dialogEmployee.id,
                  roleIds: selectedRoleIds,
                });
              }}
              disabled={syncMutation.isPending || !dialogEmployee}
            >
              {syncMutation.isPending ? "Saving…" : "Save roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RbacShell>
  );
}
