import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ActionPanel, WorkspacePageHeader } from "@/components/layout/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { getSession, setSession } from "@/lib/sessions";

function roleLabel(role: string | undefined) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "record_management") return "Records";
  if (role === "user") return "Staff";
  return role ?? "—";
}

export function SettingsPage() {
  const { user, activeSlot } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [division, setDivision] = useState(user?.division ?? "");
  const [designation, setDesignation] = useState(user?.designation ?? "");

  useEffect(() => {
    setName(user?.name ?? "");
    setDivision(user?.division ?? "");
    setDesignation(user?.designation ?? "");
  }, [user?.name, user?.division, user?.designation]);

  const profileMutation = useMutation({
    mutationFn: () =>
      api.updateProfile({
        name: name.trim(),
        division: division.trim(),
        designation: designation.trim(),
      }),
    onSuccess: ({ user: updated }) => {
      if (activeSlot) {
        const session = getSession(activeSlot);
        if (session) setSession(activeSlot, { ...session, user: updated }, { notify: false });
      }
      toast.success("Profile updated");
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not update profile");
    },
  });

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !division.trim()) {
      toast.error("Name and division are required");
      return;
    }
    profileMutation.mutate();
  };

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Settings"
        description="Manage your account details for this portal."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ActionPanel title="Account" description="These details appear in your portal header and activity logs.">
          <form className="space-y-4" onSubmit={saveProfile}>
            <div className="space-y-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input id="settings-email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-role">Role</Label>
              <Input id="settings-role" value={roleLabel(user?.role)} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-name">Display name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-division">Division / office</Label>
              <Input
                id="settings-division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="e.g. ICT"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-designation">Designation</Label>
              <Input
                id="settings-designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Museum Researcher"
                autoComplete="organization-title"
              />
            </div>
            <Button type="submit" disabled={profileMutation.isPending} className="shadow-sm">
              {profileMutation.isPending ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </ActionPanel>

        <ActionPanel title="Password" description="Your sign-in password is your PAMANA password.">
          <p className="text-sm text-muted-foreground">
            This portal signs you in with your PAMANA account and cannot change its password.
            Change your password in PAMANA, then use the new password here.
          </p>
        </ActionPanel>
      </div>
    </div>
  );
}
