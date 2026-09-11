import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, FilePlus2, ListChecks } from "lucide-react";
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
import { CLIENT_FEEDBACK, CLIENT_REQUESTS, CLIENT_SUBMIT } from "@/lib/navigation";
import {
  countTicketsNeedingFeedback,
  ticketCanMarkComplete,
  ticketNeedsFeedback,
} from "@/lib/ticket-workflow";
import { cn, formatAssignedPersonnel } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/client/dashboard")({
  component: ClientDashboardPage,
});

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function ClientDashboardPage() {
  const { user } = useAuth();
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => api.myTickets(),
  });

  const items = tickets?.items ?? [];
  const active = items.filter((t) => !["closed", "rejected"].includes(t.status)).length;
  const pending = items.filter((t) =>
    ["pending_approval", "for_process_owner", "for_client_approval"].includes(t.status),
  ).length;
  const completed = items.filter((t) => t.status === "closed").length;
  const needsFeedback = countTicketsNeedingFeedback(items);
  const canMarkComplete = items.filter(ticketCanMarkComplete).length;
  const rejected = items.filter((t) => t.status === "rejected").length;
  const recent = [...items]
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime(),
    )
    .slice(0, 6);
  const firstName = user?.name?.split(" ")[0];
  const firstFeedbackTicket = items.find(ticketNeedsFeedback);

  return (
    <div className="page-shell">
      <DashboardHero
        eyebrow="Client"
        title={firstName ? `Welcome back, ${firstName}` : "Your requests"}
        description="Track technical assistance requests and submit new ones when you need support."
        meta={
          <p className="time-pill">
            {formatToday()}
            {user?.division ? ` · ${user.division}` : ""}
          </p>
        }
        actions={
          <ActionLink to={CLIENT_SUBMIT}>
            <span className="inline-flex items-center gap-2">
              <FilePlus2 className="h-4 w-4" />
              New request
            </span>
          </ActionLink>
        }
      />

      {needsFeedback > 0 ? (
        <DashboardAlert tone="warning" title="Submit feedback">
          {needsFeedback} request{needsFeedback === 1 ? "" : "s"} need your feedback after service
          was marked complete.
          <div className="mt-2 flex flex-wrap gap-2">
            {firstFeedbackTicket ? (
              <Link
                to="/client/requests/$ticketId"
                params={{ ticketId: firstFeedbackTicket._id }}
                className={cn(buttonVariants({ size: "sm" }), "shadow-sm")}
              >
                Open request
              </Link>
            ) : null}
            <ActionLink to={CLIENT_FEEDBACK} variant="outline">
              View all
            </ActionLink>
          </div>
        </DashboardAlert>
      ) : canMarkComplete > 0 ? (
        <DashboardAlert tone="info" title="Mark service complete">
          {canMarkComplete} request{canMarkComplete === 1 ? "" : "s"} may be ready to mark complete.
          <div className="mt-2">
            <ActionLink to={CLIENT_REQUESTS}>Open my requests</ActionLink>
          </div>
        </DashboardAlert>
      ) : rejected > 0 ? (
        <DashboardAlert tone="danger" title={`${rejected} request${rejected === 1 ? "" : "s"} rejected`}>
          Open the request to review remarks and submit again if needed.
          <div className="mt-2">
            <ActionLink to={CLIENT_REQUESTS} variant="outline">
              My requests
            </ActionLink>
          </div>
        </DashboardAlert>
      ) : null}

      <div className="dashboard-stats dashboard-stats-3">
        <StatCard
          label="Active requests"
          value={active}
          hint="In progress or pending"
          to={CLIENT_REQUESTS}
          icon={ListChecks}
          accent="info"
          loading={isLoading}
        />
        <StatCard
          label="Pending approval"
          value={pending}
          hint="Waiting for admin"
          to={CLIENT_REQUESTS}
          icon={Clock3}
          accent="warning"
          loading={isLoading}
        />
        <StatCard
          label="Completed"
          value={completed}
          hint="Closed requests"
          to={CLIENT_REQUESTS}
          icon={CheckCircle2}
          accent="success"
          loading={isLoading}
        />
      </div>

      <DataPanel
        title="Recent requests"
        action={
          items.length > 0 ? (
            <ActionLink to={CLIENT_REQUESTS} variant="outline">
              View all
            </ActionLink>
          ) : undefined
        }
      >
        {isLoading ? (
          <PanelLoading label="Loading your requests…" />
        ) : recent.length === 0 ? (
          <EmptyState
            title="No requests available."
            description="Submit your first technical assistance request to get started."
            action={
              <ActionLink to={CLIENT_SUBMIT}>
                <span className="inline-flex items-center gap-2">
                  <FilePlus2 className="h-4 w-4" />
                  Submit a request
                </span>
              </ActionLink>
            }
          />
        ) : (
          <ul className="divide-y divide-border/80">
            {recent.map((t) => (
              <ListRow
                key={t._id}
                title={t.formTitle}
                subtitle={`${t.ticketNumber} · ${formatAssignedPersonnel(t.assignedTo, "Unassigned")} · ${new Date(
                  t.createdAt,
                ).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}`}
                trailing={<StatusBadge status={t.status} />}
                action={
                  <Link
                    to="/client/requests/$ticketId"
                    params={{ ticketId: t._id }}
                    className={cn(
                      buttonVariants({
                        variant: ticketNeedsFeedback(t) ? "default" : "outline",
                        size: "sm",
                      }),
                      "shadow-sm",
                    )}
                  >
                    {ticketNeedsFeedback(t) ? "Feedback" : "View"}
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
