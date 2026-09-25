import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  ActionLink,
  DataPanel,
  EmptyState,
  LoadingRows,
  StatusBadge,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { CLIENT_SUBMIT } from "@/lib/navigation";
import { ticketNeedsFeedback, ticketReadyToClose, ticketCanMarkComplete } from "@/lib/ticket-workflow";
import { cn, formatAssignedPersonnel } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/client/requests/")({
  component: MyRequestsPage,
});

function MyRequestsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => api.myTickets(),
  });

  const items = data?.items ?? [];

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="My Requests"
        description="All tickets linked to your account. Only you can view and manage these submissions."
        actions={<ActionLink to={CLIENT_SUBMIT}>New request</ActionLink>}
      />

      <DataPanel title={`${items.length} request${items.length === 1 ? "" : "s"}`}>
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-6 py-3">Ticket</th>
                  <th className="px-6 py-3">Form</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Assigned to</th>
                  <th className="px-6 py-3">Submitted</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                <LoadingRows />
              </tbody>
            </table>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No requests available."
            description="Create your first request to start tracking technical assistance."
            action={<ActionLink to={CLIENT_SUBMIT}>Submit request</ActionLink>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-6 py-3">Ticket</th>
                  <th className="px-6 py-3">Form</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Assigned to</th>
                  <th className="px-6 py-3">Submitted</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t._id} className="border-t border-border/70">
                    <td className="px-6 py-3 font-mono text-xs">{t.ticketNumber}</td>
                    <td className="px-6 py-3 font-medium">{t.formTitle}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">
                      {formatAssignedPersonnel(t.assignedTo)}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-3">
                      {ticketCanMarkComplete(t) ? (
                        <Link
                          to="/client/requests/$ticketId"
                          params={{ ticketId: t._id }}
                          className="text-sm font-medium text-maroon hover:underline"
                        >
                          Mark complete →
                        </Link>
                      ) : ticketNeedsFeedback(t) ? (
                        <Link
                          to="/client/requests/$ticketId"
                          params={{ ticketId: t._id }}
                          className="text-sm font-medium text-maroon hover:underline"
                        >
                          Submit feedback →
                        </Link>
                      ) : ticketReadyToClose(t) ? (
                        <Link
                          to="/client/requests/$ticketId"
                          params={{ ticketId: t._id }}
                          className="text-sm font-medium text-maroon hover:underline"
                        >
                          Close request →
                        </Link>
                      ) : (
                        <Link
                          to="/client/requests/$ticketId"
                          params={{ ticketId: t._id }}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "shadow-sm",
                          )}
                        >
                          View details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}
