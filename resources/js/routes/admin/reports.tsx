import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, MessageSquare, Ticket } from "lucide-react";
import {
  DataPanel,
  EmptyState,
  LoadingRows,
  StatCard,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { api } from "@/lib/api/client";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

export function ReportsPage() {
  const { canQuery } = useAdminSession();
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["report-tickets"],
    queryFn: () => api.listTickets({ limit: "100" }, "admin"),
    enabled: canQuery,
  });

  const items = tickets?.items ?? [];
  const closed = items.filter((t) => t.status === "closed").length;
  const withFeedback = items.filter((t) => t.feedbackSubmitted).length;
  const pending = items.filter((t) =>
    ["pending_approval", "for_process_owner", "for_client_approval"].includes(t.status),
  ).length;
  const feedbackItems = items
    .filter((t) => t.feedbackSubmitted)
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime(),
    );

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Reports & Analytics"
        description="Overview of request volume, completion, and client feedback across the Support Ticketing System workflow."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total requests"
          value={tickets?.total ?? 0}
          hint="All client submissions"
          icon={Ticket}
          loading={isLoading}
        />
        <StatCard
          label="Pending approval"
          value={pending}
          hint="Awaiting admin review"
          icon={BarChart3}
          loading={isLoading}
        />
        <StatCard
          label="Closed"
          value={closed}
          hint="Fully resolved requests"
          icon={CheckCircle2}
          loading={isLoading}
        />
        <StatCard
          label="With feedback"
          value={withFeedback}
          hint="Clients who submitted feedback"
          icon={MessageSquare}
          loading={isLoading}
        />
      </div>

      <DataPanel title={`Client feedback comments (${feedbackItems.length})`}>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-4 py-3 sm:px-5">Ticket</th>
                <th className="px-4 py-3 sm:px-5">Client</th>
                <th className="px-4 py-3 sm:px-5">Comment</th>
                <th className="px-4 py-3 sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows cols={4} />
              ) : feedbackItems.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      title="No feedback yet"
                      description="Client comments appear here after they confirm feedback on a completed service."
                    />
                  </td>
                </tr>
              ) : (
                feedbackItems.map((t) => (
                  <tr key={t._id} className="border-t border-border/70 align-top">
                    <td className="px-4 py-3.5 font-mono text-xs sm:px-5">{t.ticketNumber}</td>
                    <td className="px-4 py-3.5 sm:px-5">{t.creatorName}</td>
                    <td className="max-w-md px-4 py-3.5 sm:px-5">
                      <p className="whitespace-pre-wrap text-sm">
                        {t.feedbackComment?.trim() || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <Link
                        to="/admin/requests/$ticketId"
                        params={{ ticketId: t._id }}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "shadow-sm",
                        )}
                      >
                        View request
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataPanel>
    </div>
  );
}
