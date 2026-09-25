import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DataPanel,
  EmptyState,
  FlowNotice,
  PageLoader,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { api } from "@/lib/api/client";
import {
  ADMIN_APPROVALS,
  RECORDS_PENDING,
  SUPER_ADMIN_ACTIVITY,
} from "@/lib/navigation";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/super-admin/notifications")({
  component: SuperAdminNotificationsPage,
});

function SuperAdminNotificationsPage() {
  const { canQuery } = useAdminSession();
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-overview"],
    queryFn: () => api.superAdminOverview(),
    enabled: canQuery,
  });

  if (isLoading) return <PageLoader label="Loading notifications…" />;

  const pendingForms = data?.forms.pendingReview ?? 0;
  const pendingRequests = data?.tickets.pendingApproval ?? 0;

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="System Notifications"
        description="Items that need attention across Admin and Records. Use portal switcher to act on them."
      />

      <FlowNotice tone="info" title="How notifications work">
        Each portal also has a notification bell in the header. This page summarizes system-wide
        queues for Super Admin.
      </FlowNotice>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DataPanel title="Pending form reviews">
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {pendingForms} form{pendingForms === 1 ? "" : "s"} awaiting Records recommendation.
          </p>
          <div className="border-t border-border/80 px-4 py-3">
            <Link to={RECORDS_PENDING} className="text-sm font-medium text-maroon hover:underline">
              Open Records · Pending Forms →
            </Link>
          </div>
        </DataPanel>

        <DataPanel title="Pending client approvals">
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {pendingRequests} request{pendingRequests === 1 ? "" : "s"} awaiting Admin approval.
          </p>
          <div className="border-t border-border/80 px-4 py-3">
            <Link to={ADMIN_APPROVALS} className="text-sm font-medium text-maroon hover:underline">
              Open Admin · Approvals →
            </Link>
          </div>
        </DataPanel>
      </div>

      <div className="mt-4">
        <DataPanel title="Audit trail">
          {data?.recentActivities.length ? (
            <ul className="divide-y divide-border/80">
              {data.recentActivities.slice(0, 10).map((row) => (
                <li key={row._id} className="px-4 py-2.5 text-sm">
                  <p className="font-medium text-foreground">{row.summary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.actorName || "System"} · {new Date(row.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No alerts" description="Recent system activity will show here." />
          )}
          <div className="border-t border-border/80 px-4 py-3">
            <Link to={SUPER_ADMIN_ACTIVITY} className="text-sm font-medium text-maroon hover:underline">
              Open Activity Logs →
            </Link>
          </div>
        </DataPanel>
      </div>
    </div>
  );
}
