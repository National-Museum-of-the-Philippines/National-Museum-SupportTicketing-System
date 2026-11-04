import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ClipboardCheck, Clock, FilePenLine } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import {
  ActionLink,
  DashboardAlert,
} from "@/components/layout/workspace-ui";
import {
  HeroLink,
  OverviewHero,
  OverviewStat,
  TodayActivity,
} from "@/components/layout/dashboard-overview";
import { ADMIN_APPROVALS, ADMIN_ASSIGNED, ADMIN_FORMS } from "@/lib/navigation";
import { AdminDashboardLegacy } from "./-dashboard-legacy";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  return <AdminDashboardResty />;
}

function AdminDashboardResty() {
  const { user } = useAuth();
  const { canQuery } = useAdminSession();
  const { data: forms, isLoading: formsLoading } = useQuery({
    queryKey: ["my-forms"],
    queryFn: () => api.myForms(),
  });
  const { data: assigned } = useQuery({
    queryKey: ["assigned-tickets"],
    queryFn: () => api.listAssignedTickets("admin"),
    enabled: canQuery,
  });
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["admin-tickets-dashboard"],
    queryFn: () => api.listTickets({ status: "pending_approval", limit: "8" }, "admin"),
    enabled: canQuery,
  });
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: () => {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      return api.adminActivity({ since: midnight.toISOString(), limit: 200 });
    },
    enabled: canQuery,
    refetchInterval: 60_000,
  });
  const assignedCount = assigned?.items.length ?? 0;

  const items = forms?.items ?? [];
  const pendingForms = items.filter((f) => f.status === "pending_review").length;
  const draftForms = items.filter((f) => f.status === "draft").length;
  const disapprovedForms = items.filter((f) => f.status === "disapproved");
  const pendingTickets = tickets?.items ?? [];
  const pendingApprovalCount = tickets?.pendingCount ?? pendingTickets.length;
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="page-shell">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <OverviewHero
          title={firstName ? `Good day, ${firstName}` : "Dashboard"}
          actions={
            <>
              <HeroLink to={ADMIN_APPROVALS}>Review approvals</HeroLink>
              <HeroLink to={ADMIN_FORMS} variant="outline">
                Open Form Builder
              </HeroLink>
            </>
          }
        >
          {pendingApprovalCount > 0 || pendingForms > 0 ? (
            <>
              You have <strong className="text-lg font-bold text-white">{pendingApprovalCount} request{pendingApprovalCount === 1 ? "" : "s"}</strong>{" "}
              waiting for approval and {pendingForms} pending review with Records.
            </>
          ) : (
            "You're all caught up. Manage TA forms and review incoming client requests."
          )}
        </OverviewHero>
        <div className="flex flex-col gap-4">
          <OverviewStat label="Requests to approve" hint="Client submissions" value={pendingApprovalCount} to={ADMIN_APPROVALS} icon={ClipboardCheck} loading={ticketsLoading} />
          <OverviewStat label="Pending review" hint="Waiting on Records" value={pendingForms} to={ADMIN_FORMS} icon={Clock} loading={formsLoading} />
          <OverviewStat label="Draft forms" hint="Not yet submitted" value={draftForms} to={ADMIN_FORMS} icon={FilePenLine} loading={formsLoading} />
        </div>
      </div>

      {assignedCount > 0 ? (
        <DashboardAlert tone="info" title="You have assigned requests">
          You were assigned to {assignedCount} request{assignedCount === 1 ? "" : "s"}.
          <div className="mt-2">
            <ActionLink to={ADMIN_ASSIGNED}>Open My Assignments</ActionLink>
          </div>
        </DashboardAlert>
      ) : null}

      {disapprovedForms.length > 0 ? (
        <DashboardAlert
          tone="danger"
          title={`${disapprovedForms.length} form${disapprovedForms.length === 1 ? "" : "s"} need revision`}
          action={
            <ActionLink to={ADMIN_FORMS} variant="outline">
              Open Form Builder
            </ActionLink>
          }
        >
          <ul className="space-y-2">
            {disapprovedForms.slice(0, 3).map((f) => (
              <li key={f._id} className="flex gap-2 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>
                  <span className="font-medium text-foreground">{f.title}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {f.reviewRemarks?.trim() || "No remarks provided"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </DashboardAlert>
      ) : pendingApprovalCount > 0 ? (
        <DashboardAlert tone="warning" title={`${pendingApprovalCount} client request${pendingApprovalCount === 1 ? "" : "s"} awaiting approval`}>
          Review submitted requests before they move to assignment and processing.
          <div className="mt-3">
            <ActionLink to={ADMIN_APPROVALS}>Open Approvals</ActionLink>
          </div>
        </DashboardAlert>
      ) : null}

      <TodayActivity items={activity?.items ?? []} loading={activityLoading} />
    </div>
  );
}
