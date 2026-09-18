import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileStack,
  KeyRound,
  LayoutDashboard,
  Settings,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ensurePortalRole } from "@/lib/portal-guard";
import { useAdminSession } from "@/lib/use-portal-session";
import {
  ADMIN_DASHBOARD,
  CLIENT_DASHBOARD,
  isSuperAdminRole,
  RECORDS_DASHBOARD,
  SUPER_ADMIN_ACTIVITY,
  SUPER_ADMIN_DASHBOARD,
  SUPER_ADMIN_FORMS,
  SUPER_ADMIN_NOTIFICATIONS,
  SUPER_ADMIN_PERMISSIONS,
  SUPER_ADMIN_PROFILE,
  SUPER_ADMIN_REPORTS,
  SUPER_ADMIN_ROLES,
  SUPER_ADMIN_SETTINGS,
  SUPER_ADMIN_USERS,
} from "@/lib/navigation";

export const Route = createFileRoute("/super-admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    await ensurePortalRole(isSuperAdminRole, "admin");
    if (location.pathname === "/super-admin" || location.pathname === "/super-admin/") {
      throw redirect({ to: SUPER_ADMIN_DASHBOARD, replace: true });
    }
  },
  component: SuperAdminLayout,
});

function SuperAdminLayout() {
  useAdminSession();

  return (
    <DashboardShell
      portalTitle="Super Admin"
      notificationsEmptyMessage="No system alerts"
      navSections={[
        {
          title: "MAIN",
          items: [
            { to: SUPER_ADMIN_DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
            { to: SUPER_ADMIN_REPORTS, label: "Reports & Analytics", icon: BarChart3 },
          ],
        },
        {
          title: "PORTALS / ACCESS",
          items: [
            { to: ADMIN_DASHBOARD, label: "Admin Portal", icon: Building2 },
            { to: RECORDS_DASHBOARD, label: "Records Portal", icon: ClipboardList },
            { to: CLIENT_DASHBOARD, label: "Staff/Client Portal", icon: Users },
          ],
        },
        {
          title: "USER & ACCESS MANAGEMENT",
          items: [
            { to: SUPER_ADMIN_USERS, label: "Users", icon: Users },
            { to: SUPER_ADMIN_ROLES, label: "Roles", icon: Shield },
            { to: SUPER_ADMIN_PERMISSIONS, label: "Permissions", icon: KeyRound },
          ],
        },
        {
          title: "SYSTEM MANAGEMENT",
          items: [
            { to: SUPER_ADMIN_SETTINGS, label: "System Settings", icon: Settings },
            { to: SUPER_ADMIN_FORMS, label: "Form Management", icon: FileStack },
            { to: SUPER_ADMIN_ACTIVITY, label: "Activity Logs / Audit Logs", icon: Activity },
            { to: SUPER_ADMIN_NOTIFICATIONS, label: "System Notifications", icon: Bell },
          ],
        },
        {
          title: "ACCOUNT",
          items: [
            { to: SUPER_ADMIN_PROFILE, label: "My Profile", icon: UserCircle },
            { to: SUPER_ADMIN_SETTINGS, label: "Settings", icon: Settings },
          ],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}
