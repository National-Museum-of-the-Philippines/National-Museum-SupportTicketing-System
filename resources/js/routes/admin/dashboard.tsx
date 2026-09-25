import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ClipboardCheck, FilePenLine, FileStack } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import {
  ActionLink,
  DashboardAlert,
  DashboardHero,
  DataPanel,
  EmptyState,
  ListRow,
  PanelLoading,
  StatCard,
  StatusBadge,
} from "@/components/layout/workspace-ui";
import { ADMIN_APPROVALS, ADMIN_ASSIGNED, ADMIN_FORMS, ADMIN_MY_FORMS } from "@/lib/navigation";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
});

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function AdminDashboardPage() {
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
      <DashboardHero
        eyebrow="Admin"
        title={firstName ? `Good day, ${firstName}` : "Dashboard"}
        description="Manage TA forms and review incoming client requests."
        meta={<p className="time-pill">{formatToday()}</p>}
        actions={
          <>
            <ActionLink to={ADMIN_FORMS}>Form Builder</ActionLink>
            {pendingApprovalCount > 0 ? (
              <ActionLink to={ADMIN_APPROVALS} variant="outline">
                Approvals ({pendingApprovalCount})
              </ActionLink>
            ) : null}
          </>
        }
      />

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
            <ActionLink to={ADMIN_MY_FORMS} variant="outline">
              Open My Forms
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

      <div className="dashboard-stats">
        <StatCard
          label="Requests to approve"
          value={pendingApprovalCount}
          hint="Client submissions"
          to={ADMIN_APPROVALS}
          icon={ClipboardCheck}
          accent="info"
          loading={ticketsLoading}
        />
        <StatCard
          label="Pending review"
          value={pendingForms}
          hint="Waiting on Records"
          to={ADMIN_MY_FORMS}
          icon={FileStack}
          accent="warning"
          loading={formsLoading}
        />
        <StatCard
          label="Draft forms"
          value={draftForms}
          hint="Not yet submitted"
          to={ADMIN_MY_FORMS}
          icon={FilePenLine}
          loading={formsLoading}
        />
      </div>

      <DataPanel
        title="Pending client requests"
        action={
          pendingTickets.length > 0 ? (
            <ActionLink to={ADMIN_APPROVALS} variant="outline">
              View all
            </ActionLink>
          ) : undefined
        }
      >
        {ticketsLoading ? (
          <PanelLoading label="Loading requests…" />
        ) : pendingTickets.length === 0 ? (
          <EmptyState
            title="No pending approvals"
            description="New client requests will appear here when submitted."
          />
        ) : (
          <ul className="divide-y divide-border/80">
            {pendingTickets.map((t) => (
              <ListRow
                key={t._id}
                title={t.formTitle}
                subtitle={`${t.ticketNumber} · ${t.creatorName}${t.division ? ` · ${t.division}` : ""}`}
                trailing={<StatusBadge status={t.status} />}
                action={
                  <Link
                    to="/admin/requests/$ticketId"
                    params={{ ticketId: t._id }}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shadow-sm")}
                  >
                    Review
                  </Link>
                }
              />
            ))}
          </ul>
        )}
      </DataPanel>
    </div>
  );
}
