import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { BookOpen, Clock, History, LayoutDashboard } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PortalGateCard } from "@/components/layout/workspace-ui";
import { Button } from "@/components/ui/button";
import { useMessageRealtime } from "@/hooks/use-message-realtime";
import { api } from "@/lib/api/client";
import { ensurePortalRole } from "@/lib/portal-guard";
import { useLiveNotifications } from "@/lib/live-notifications";
import { recordsPendingNotifications } from "@/lib/notifications";
import { useRecordsSession } from "@/lib/use-portal-session";
import {
  isRecordsRole,
  LOGIN,
  RECORDS_ACTIVITY,
  RECORDS_DASHBOARD,
  RECORDS_PENDING,
  RECORDS_PUBLISHED,
} from "@/lib/navigation";

export const Route = createFileRoute("/records")({
  beforeLoad: async ({ location }) => {
    await ensurePortalRole(isRecordsRole, "records");
    if (location.pathname === "/records" || location.pathname === "/records/") {
      throw redirect({ to: RECORDS_DASHBOARD, replace: true });
    }
  },
  component: RecordsLayout,
});

function RecordsLayout() {
  const { user, sessionReady, logout, canQuery } = useRecordsSession();
  useMessageRealtime("records");
  const liveNotifications = useLiveNotifications("records");

  const {
    data,
    isError,
    isLoading: notificationsLoading,
  } = useQuery({
    queryKey: ["records-dashboard"],
    queryFn: () => api.recordsDashboard(),
    enabled: canQuery,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  const pendingCount = canQuery && !isError ? data?.pendingCount : undefined;
  const notifications = useMemo(
    () => [
      ...liveNotifications,
      ...(canQuery && !isError ? recordsPendingNotifications(data?.recentPending ?? []) : []),
    ],
    [liveNotifications, canQuery, isError, data?.recentPending],
  );

  if (sessionReady && user && !isRecordsRole(user.role)) {
    return (
      <PortalGateCard
        title="Wrong account for Records"
        description={
          <>
            No Records session found. Log in at <strong>{LOGIN}</strong> with a{" "}
            <strong>record management</strong> museum account.
          </>
        }
      >
        <Button type="button" onClick={() => logout()}>
          Sign out
        </Button>
        <Link to={LOGIN}>
          <Button variant="outline">Go to login</Button>
        </Link>
      </PortalGateCard>
    );
  }

  return (
    <DashboardShell
      portalTitle="Record Admin"
      notifications={notifications}
      notificationsLoading={notificationsLoading && canQuery}
      notificationsViewAllTo={RECORDS_PENDING}
      notificationsEmptyMessage="No forms waiting for review"
      navSections={[
        {
          title: "MAIN",
          items: [{ to: RECORDS_DASHBOARD, label: "Dashboard", icon: LayoutDashboard }],
        },
        {
          title: "FORMS",
          items: [
            { to: RECORDS_PENDING, label: "Pending Forms", icon: Clock, badge: pendingCount },
            { to: RECORDS_PUBLISHED, label: "Published Forms", icon: BookOpen },
          ],
        },
        {
          title: "SYSTEM",
          items: [{ to: RECORDS_ACTIVITY, label: "Activity Logs", icon: History }],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}
