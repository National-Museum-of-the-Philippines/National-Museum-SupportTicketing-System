import { useUnreadMessages } from "@/lib/messenger-store";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  FilePenLine,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  Send,
  Ticket,
  UserCheck,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useMessageNotifications } from "@/hooks/use-message-notifications";
import { useMessageRealtime } from "@/hooks/use-message-realtime";
import { usePokeNotifications } from "@/hooks/use-poke-notifications";
import { api } from "@/lib/api/client";
import { useLiveNotifications } from "@/lib/live-notifications";
import { adminApprovalNotifications, adminAssignmentNotifications, assignedPersonnelNotifications } from "@/lib/notifications";
import { ensurePortalRole } from "@/lib/portal-guard";
import { useAdminSession } from "@/lib/use-portal-session";
import {
  ADMIN_APPROVALS,
  ADMIN_ASSIGNED,
  ADMIN_DASHBOARD,
  ADMIN_FORMS,
  ADMIN_MESSAGES,
  ADMIN_MY_REQUESTS,
  ADMIN_MY_REQUESTS_SUBMIT,
  ADMIN_PUBLISHED_FORMS,
  ADMIN_REPORTS,
  ADMIN_REQUESTS,
  isAdminRole,
} from "@/lib/navigation";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    await ensurePortalRole(isAdminRole, "admin");
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      throw redirect({ to: ADMIN_DASHBOARD, replace: true });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { canQuery } = useAdminSession();
  useMessageRealtime("admin");
  const liveNotifications = useLiveNotifications("admin");
  const pokeNotifications = usePokeNotifications("admin", canQuery);
  const messageNotifications = useMessageNotifications("admin", canQuery);
  const { data: tickets, isLoading: notificationsLoading } = useQuery({
    queryKey: ["admin-tickets-pending"],
    queryFn: () => api.listTickets({ status: "pending_approval" }, "admin"),
    enabled: canQuery,
  });

  const { data: assignedTickets } = useQuery({
    queryKey: ["assigned-tickets"],
    queryFn: () => api.listAssignedTickets("admin"),
    enabled: canQuery,
  });

  // Same query as Request Management, so it stays live and shared. Used to flag
  // approved requests that are waiting for this admin to assign personnel.
  const { data: managedTickets } = useQuery({
    queryKey: ["all-tickets"],
    queryFn: () => api.listTickets({ scope: "management" }, "admin"),
    enabled: canQuery,
  });
  const assignmentNotifications = useMemo(
    () => adminAssignmentNotifications(managedTickets?.items ?? []),
    [managedTickets?.items],
  );

  const notifications = useMemo(
    () => [
      ...liveNotifications,
      ...messageNotifications,
      ...pokeNotifications,
      ...assignedPersonnelNotifications(assignedTickets?.items ?? [], "/admin/requests/$ticketId"),
      ...assignmentNotifications,
      ...adminApprovalNotifications(tickets?.items ?? []),
    ],
    [liveNotifications, messageNotifications, pokeNotifications, assignedTickets?.items, tickets?.items, assignmentNotifications],
  );

  const unreadMessages = useUnreadMessages();

  return (
    <DashboardShell
      portalTitle="Admin"
      notifications={notifications}
      notificationsLoading={notificationsLoading}
      notificationsViewAllTo={ADMIN_APPROVALS}
      notificationsEmptyMessage="No pending client requests"
      navSections={[
        {
          title: "MAIN",
          items: [
            { to: ADMIN_DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
            { to: ADMIN_REPORTS, label: "Reports", icon: BarChart3 },
            { to: ADMIN_MESSAGES, label: "Messages", icon: MessageCircle, badge: unreadMessages },
          ],
        },
        {
          title: "FORMS",
          items: [
            { to: ADMIN_FORMS, label: "Form Builder", icon: FilePenLine },
            { to: ADMIN_PUBLISHED_FORMS, label: "Published Forms", icon: FileCheck2 },
          ],
        },
        {
          title: "REQUESTS",
          items: [
            {
              to: ADMIN_APPROVALS,
              label: "Approvals",
              icon: ClipboardCheck,
              badge: tickets?.pendingCount ?? notifications.length,
            },
            {
              to: ADMIN_REQUESTS,
              label: "Request Management",
              icon: Ticket,
              badge: assignmentNotifications.length || undefined,
            },
            { to: ADMIN_ASSIGNED, label: "Assigned to me", icon: UserCheck, badge: assignedTickets?.items.length },
            { to: ADMIN_MY_REQUESTS, label: "My Requests", icon: Inbox },
            { to: ADMIN_MY_REQUESTS_SUBMIT, label: "Submit Request", icon: Send },
          ],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}
