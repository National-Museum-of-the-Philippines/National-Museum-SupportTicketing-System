import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  DataPanel,
  EmptyState,
  LoadingRows,
  WorkspacePageHeader,
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
import { useAdminSession } from "@/lib/use-portal-session";

const EMPTY_FORM = {
  email: "",
  name: "",
  designation: "",
  password: "",
  password_confirmation: "",
};

/** Admin: add and deactivate the COS staff of the Admin's own section. */
export function CosUserManagementPage() {
  const qc = useQueryClient();
  const { canQuery } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cos-users"],
    queryFn: () => api.listCosUsers(),
    enabled: canQuery,
  });
  const items = data?.items ?? [];

  const close = () => {
    setOpen(false);
    setForm(EMPTY_FORM);
  };

  const create = useMutation({
    mutationFn: () => api.createCosUser(form),
    onSuccess: ({ user }) => {
      toast.success(`${user.name} added. Username: ${user.username}`, { duration: 12000 });
      close();
      void qc.invalidateQueries({ queryKey: ["cos-users"] });
    },
    onError: (err: Error) =>
      toast.error(err instanceof ApiError ? err.message : "Could not add the user."),
  });

  const setActive = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      api.setCosUserActive(userId, active),
    onSuccess: ({ user }) => {
      toast.success(`${user.name} ${user.active ? "activated" : "deactivated"}`);
      void qc.invalidateQueries({ queryKey: ["cos-users"] });
    },
    onError: (err: Error) =>
      toast.error(err instanceof ApiError ? err.message : "Could not update the user."),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.password_confirmation) {
      toast.error("The passwords do not match.");
      return;
    }
    create.mutate();
  };

  const field = (
    key: keyof typeof EMPTY_FORM,
    label: string,
    type = "text",
    placeholder = "",
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cos-${key}`}>{label}</Label>
      <Input
        id={`cos-${key}`}
        type={type}
        required
        value={form[key]}
        placeholder={placeholder}
        autoComplete={type === "password" ? "new-password" : "off"}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="User Management"
        description="COS staff of your section who are not registered in PAMANA. They sign in with their username (firstname.lastname) and the password you set."
        actions={
          <Button size="sm" onClick={() => setOpen(true)} disabled={!canQuery || isError}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add user
          </Button>
        }
      />

      {isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load users."}
        </div>
      ) : null}

      <DataPanel
        title={`${items.length} COS user${items.length === 1 ? "" : "s"}`}
        description={data?.section}
      >
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-4 py-3 sm:px-5">Name</th>
                <th className="px-4 py-3 sm:px-5">Username</th>
                <th className="px-4 py-3 sm:px-5">Email</th>
                <th className="px-4 py-3 sm:px-5">Designation</th>
                <th className="px-4 py-3 sm:px-5">Role</th>
                <th className="px-4 py-3 sm:px-5">Status</th>
                <th className="px-4 py-3 sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {!canQuery || isLoading ? (
                <LoadingRows cols={7} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No COS users yet"
                      description="Click Add user to register a COS staff member of your section."
                    />
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.userId} className="border-t border-border/70">
                    <td className="px-4 py-3.5 font-medium sm:px-5">{u.name}</td>
                    <td className="px-4 py-3.5 font-mono text-xs sm:px-5">{u.username}</td>
                    <td className="px-4 py-3.5 sm:px-5">{u.email}</td>
                    <td className="px-4 py-3.5 sm:px-5">{u.designation || "—"}</td>
                    <td className="px-4 py-3.5 sm:px-5">{u.role}</td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <span className={u.active ? "text-emerald-700" : "text-muted-foreground"}>
                        {u.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setActive.isPending}
                        onClick={() => {
                          if (
                            u.active &&
                            !window.confirm(`Deactivate ${u.name}? They will not be able to sign in.`)
                          ) {
                            return;
                          }
                          setActive.mutate({ userId: u.userId, active: !u.active });
                        }}
                      >
                        {u.active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataPanel>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add COS user</DialogTitle>
            <DialogDescription>
              The username is made from the display name (firstname.lastname). Role is Staff and the division is your section
              {data?.section ? ` (${data.section})` : ""}. The password cannot be reset later, so
              note it down for the user.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {field("email", "Email", "email", "name@example.com")}
            {field("name", "Display name", "text", "First Middle Last")}
            {field("designation", "Designation", "text", "e.g. Computer Programmer")}
            {field("password", "Password (at least 8 characters)", "password")}
            {field("password_confirmation", "Confirm password", "password")}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Adding…" : "Add user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
