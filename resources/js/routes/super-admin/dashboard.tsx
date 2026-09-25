import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardList, Users } from "lucide-react";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import {
  DataPanel,
  EmptyState,
  PageLoader,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { api } from "@/lib/api/client";
import {
  ADMIN_DASHBOARD,
  CLIENT_DASHBOARD,
  RECORDS_DASHBOARD,
  SUPER_ADMIN_ACTIVITY,
} from "@/lib/navigation";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/super-admin/dashboard")({
  component: SuperAdminDashboardPage,
});

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function PortalLink({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: typeof Building2;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5 transition-colors hover:border-maroon/30 hover:bg-maroon/[0.03]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon/8 text-maroon">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground group-hover:text-maroon">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}

function SuperAdminDashboardPage() {
  const { canQuery } = useAdminSession();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["super-admin-overview"],
    queryFn: () => api.superAdminOverview(),
    enabled: canQuery,
  });

  if (isLoading) {
    return <PageLoader label="Loading system overview…" />;
  }

  if (isError || !data) {
    return (
      <div className="page-shell">
        <WorkspacePageHeader
          title="Dashboard"
          description="Overall status of the Support Ticketing System."
        />
        <EmptyState
          title="Could not load overview"
          description={error instanceof Error ? error.message : "Try again later."}
        />
      </div>
    );
  }

  const { users, forms, tickets, recentActivities } = data;
  const completed = tickets.resolved + tickets.closed;

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Dashboard"
        description="Overall status of the Support Ticketing System — users, forms, requests, and recent activity."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={users.total} />
        <StatCard label="Total Admins" value={users.admins + users.superAdmins} />
        <StatCard label="Records Personnel" value={users.records} />
        <StatCard label="Staff" value={users.staff} />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Forms" value={forms.pendingReview} />
        <StatCard label="Published Forms" value={forms.published} />
        <StatCard label="Pending Requests" value={tickets.pendingApproval} />
        <StatCard label="In Progress" value={tickets.inProgress} />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completed (Resolved)" value={tickets.resolved} />
        <StatCard label="Closed Tickets" value={tickets.closed} />
        <StatCard label="Reopened" value={tickets.reopened} />
        <StatCard label="Completed + Closed" value={completed} />
      </section>

      <section className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Portal access
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <PortalLink
            to={ADMIN_DASHBOARD}
            title="Admin Portal"
            description="Forms, approvals, assignments, and requests"
            icon={Building2}
          />
          <PortalLink
            to={RECORDS_DASHBOARD}
            title="Records Portal"
            description="Review pending forms and publish templates"
            icon={ClipboardList}
          />
          <PortalLink
            to={CLIENT_DASHBOARD}
            title="Staff / Client Portal"
            description="View the system as an ordinary employee"
            icon={Users}
          />
        </div>
      </section>

      <section className="mt-6">
        <DataPanel
          title="Recent activities"
          action={
            <Link
              to={SUPER_ADMIN_ACTIVITY}
              className="text-sm font-medium text-maroon hover:underline"
            >
              View all logs
            </Link>
          }
        >
          <ActivityFeed
            items={recentActivities.slice(0, 8)}
            denser
            empty={
              <EmptyState
                title="No recent activity"
                description="System events will appear here."
              />
            }
          />
        </DataPanel>
      </section>
    </div>
  );
}
