import { useUnreadMessages } from "@/lib/messenger-store";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Inbox, LayoutDashboard, MessageCircle, MessageSquare, Send, ShieldCheck, ClipboardCheck, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useMessageNotifications } from "@/hooks/use-message-notifications";
import { useMessageRealtime } from "@/hooks/use-message-realtime";
import { usePokeNotifications } from "@/hooks/use-poke-notifications";
import { api } from "@/lib/api/client";
import { ensurePortalRole } from "@/lib/portal-guard";
import {
  assignedPersonnelNotifications,
  clientReviewNotifications,
  clientTicketNotifications,
} from "@/lib/notifications";
import { useLiveNotifications } from "@/lib/live-notifications";
import { useAuth } from "@/lib/auth";
import { useSeenTicketUpdates } from "@/lib/seen-ticket-updates";
import {
  CLIENT_ASSIGNED,
  CLIENT_DASHBOARD,
  CLIENT_FEEDBACK,
  CLIENT_MESSAGES,
  CLIENT_REQUESTS,
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
  const { user } = useAuth();
  const seenUpdates = useSeenTicketUpdates(user?.id);
  const liveNotifications = useLiveNotifications("client");
  const pokeNotifications = usePokeNotifications("client");
  const messageNotifications = useMessageNotifications("client");
  const { data: tickets, isLoading: notificationsLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => api.myTickets("client"),
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
      ...clientReviewNotifications(supervisorQueue?.items ?? [], "supervisor", CLIENT_REVIEW_SUPERVISOR),
      ...assignedPersonnelNotifications(assignedTickets?.items ?? [], "/client/requests/$ticketId"),
      ...clientTicketNotifications(tickets?.items ?? [], seenUpdates),
    ],
    [
      liveNotifications,
      messageNotifications,
      pokeNotifications,
      assignedTickets?.items,
      tickets?.items,
      supervisorQueue?.items,
      seenUpdates,
    ],
  );
  // My Requests badge: only the user's own requests that need action (not every bell notice).
  const actionCount = useMemo(
    () => clientTicketNotifications(tickets?.items ?? [], seenUpdates).length,
    [tickets?.items, seenUpdates],
  );
  const feedbackCount = countTicketsNeedingFeedback(tickets?.items ?? []);

  const unreadMessages = useUnreadMessages();

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
            { to: CLIENT_MESSAGES, label: "Messages", icon: MessageCircle, badge: unreadMessages },
          ],
        },
        {
          title: "REQUESTS",
          items: [
            // Only people named as an Immediate Supervisor in PAMANA review here.
            ...(supervisorQueue?.canReviewSupervisor
              ? [
                  {
                    to: CLIENT_REVIEW_SUPERVISOR,
                    label: "For Review (Supervisor)",
                    icon: ShieldCheck,
                    badge: supervisorQueue.total,
                  },
                ]
              : []),
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
