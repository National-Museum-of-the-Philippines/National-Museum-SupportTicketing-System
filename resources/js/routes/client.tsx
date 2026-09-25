import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Inbox, LayoutDashboard, MessageCircle, MessageSquare, Send, FileCheck, ShieldCheck, ClipboardCheck, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useMessageNotifications } from "@/hooks/use-message-notifications";
import { useMessageRealtime } from "@/hooks/use-message-realtime";
import { usePokeNotifications } from "@/hooks/use-poke-notifications";
import { api } from "@/lib/api/client";
import { ensurePortalRole } from "@/lib/portal-guard";
import { assignedPersonnelNotifications, clientTicketNotifications } from "@/lib/notifications";
import { useLiveNotifications } from "@/lib/live-notifications";
import {
  CLIENT_ASSIGNED,
  CLIENT_DASHBOARD,
  CLIENT_FEEDBACK,
  CLIENT_MESSAGES,
  CLIENT_REQUESTS,
  CLIENT_REVIEW_RECOMMENDING,
  CLIENT_REVIEW_SUPERVISOR,
  CLIENT_REVIEW_ACTION_OFFICER,
  CLIENT_SUBMIT,
  isClientRole,
} from "@/lib/navigation";
import { countTicketsNeedingFeedback } from "@/lib/ticket-workflow";

export const Route = createFileRoute("/client")({
  beforeLoad: async ({ location }) => {
    await ensurePortalRole(isClientRole, "client");
    if (location.pathname === "/client" || location.pathname === "/client/") {
      throw redirect({ to: CLIENT_DASHBOARD, replace: true });
    }
  },
  component: ClientLayout,
});

function ClientLayout() {
  useMessageRealtime("client");
  const liveNotifications = useLiveNotifications("client");
  const pokeNotifications = usePokeNotifications("client");
  const messageNotifications = useMessageNotifications("client");
  const { data: tickets, isLoading: notificationsLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => api.myTickets("client"),
  });
  const { data: recommendingQueue } = useQuery({
    queryKey: ["review-recommending"],
    queryFn: () =>
      api.listClientReview("recommending", "client").catch(() => ({
        items: [],
        total: 0,
        canReviewRecommending: false,
        canReviewSupervisor: false,
      })),
  });
  const { data: supervisorQueue } = useQuery({
    queryKey: ["review-supervisor"],
    queryFn: () =>
      api.listClientReview("supervisor", "client").catch(() => ({
        items: [],
        total: 0,
        canReviewRecommending: false,
        canReviewSupervisor: false,
      })),
  });
  const { data: actionOfficerQueue } = useQuery({
    queryKey: ["review-action-officer"],
    queryFn: () =>
      api.listClientReview("action_officer", "client").catch(() => ({
        items: [],
        total: 0,
        canReviewRecommending: false,
        canReviewSupervisor: false,
      })),
  });
  const { data: assignedTickets } = useQuery({
    queryKey: ["assigned-tickets"],
    queryFn: () => api.listAssignedTickets("client").catch(() => ({ items: [] })),
  });

  const notifications = useMemo(
    () => [
      ...liveNotifications,
      ...messageNotifications,
      ...pokeNotifications,
      ...assignedPersonnelNotifications(assignedTickets?.items ?? [], "/client/requests/$ticketId"),
      ...clientTicketNotifications(tickets?.items ?? []),
    ],
    [liveNotifications, messageNotifications, pokeNotifications, assignedTickets?.items, tickets?.items],
  );
  const actionCount = notifications.length;
  const feedbackCount = countTicketsNeedingFeedback(tickets?.items ?? []);

  return (
    <DashboardShell
      portalTitle="Client Portal"
      notifications={notifications}
      notificationsLoading={notificationsLoading}
      notificationsViewAllTo={CLIENT_REQUESTS}
      notificationsEmptyMessage="No updates on your requests"
      navSections={[
        {
          title: "MAIN",
          items: [
            { to: CLIENT_DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
            {
              to: CLIENT_ASSIGNED,
              label: "Assigned to me",
              icon: UserCheck,
              badge: assignedTickets?.items.length,
            },
            { to: CLIENT_MESSAGES, label: "Messages", icon: MessageCircle },
          ],
        },
        {
          title: "REQUESTS",
          items: [
            {
              to: CLIENT_REVIEW_RECOMMENDING,
              label: "For Review (Recommending)",
              icon: FileCheck,
              badge: recommendingQueue?.total,
            },
            {
              to: CLIENT_REVIEW_SUPERVISOR,
              label: "For Review (Supervisor)",
              icon: ShieldCheck,
              badge: supervisorQueue?.total,
            },
            {
              to: CLIENT_REVIEW_ACTION_OFFICER,
              label: "For Review (Action Officer)",
              icon: ClipboardCheck,
              badge: actionOfficerQueue?.total,
            },
            { to: CLIENT_SUBMIT, label: "Submit Request", icon: Send },
            {
              to: CLIENT_REQUESTS,
              label: "My Requests",
              icon: Inbox,
              badge: actionCount || undefined,
            },
            {
              to: CLIENT_FEEDBACK,
              label: "Service Feedback",
              icon: MessageSquare,
              badge: feedbackCount || undefined,
            },
          ],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}
