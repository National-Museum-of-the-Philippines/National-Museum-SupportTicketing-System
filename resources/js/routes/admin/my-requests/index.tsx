import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api/client";
import {
  ActionLink,
  DataPanel,
  EmptyState,
  LoadingRows,
  StatusBadge,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { TicketPdfViewerDialog } from "@/components/tickets/TicketPdfViewerDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { ADMIN_MY_REQUESTS_SUBMIT } from "@/lib/navigation";
import { ticketNeedsFeedback, ticketReadyToClose, ticketCanMarkComplete } from "@/lib/ticket-workflow";
import { cn, formatAssignedPersonnel } from "@/lib/utils";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/admin/my-requests/")({
  component: AdminMyRequestsPage,
});

/**
 * Admin's personal TA requests (as requestor/client), separate from Request Management.
 */
function AdminMyRequestsPage() {
  const { canQuery } = useAdminSession();
  const [viewTicket, setViewTicket] = useState<{ id: string; number: string } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets", "admin"],
    queryFn: () => api.myTickets("admin"),
    enabled: canQuery,
  });

  const items = data?.items ?? [];

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="My Requests"
        description="Your own support request submissions. Use this when you need assistance as a requestor."
        actions={<ActionLink to={ADMIN_MY_REQUESTS_SUBMIT}>New request</ActionLink>}
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
            title="No personal requests yet."
            description="Submit a TA request for yourself — it will appear here, not under Request Management as an assignee view."
            action={<ActionLink to={ADMIN_MY_REQUESTS_SUBMIT}>Submit request</ActionLink>}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewTicket({ id: t._id, number: t.ticketNumber })}
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          View file
                        </Button>
                        {ticketCanMarkComplete(t) ? (
                          <Link
                            to="/admin/my-requests/$ticketId"
                            params={{ ticketId: t._id }}
                            className="text-sm font-medium text-maroon hover:underline"
                          >
                            Mark complete →
                          </Link>
                        ) : ticketNeedsFeedback(t) ? (
                          <Link
                            to="/admin/my-requests/$ticketId"
                            params={{ ticketId: t._id }}
                            className="text-sm font-medium text-maroon hover:underline"
                          >
                            Submit feedback →
                          </Link>
                        ) : ticketReadyToClose(t) ? (
                          <Link
                            to="/admin/my-requests/$ticketId"
                            params={{ ticketId: t._id }}
                            className="text-sm font-medium text-maroon hover:underline"
                          >
                            Close request →
                          </Link>
                        ) : (
                          <Link
                            to="/admin/my-requests/$ticketId"
                            params={{ ticketId: t._id }}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "shadow-sm",
                            )}
                          >
                            View details
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      <TicketPdfViewerDialog
        ticketId={viewTicket?.id ?? null}
        ticketNumber={viewTicket?.number}
        open={Boolean(viewTicket)}
        onOpenChange={(open) => {
          if (!open) setViewTicket(null);
        }}
        slot="admin"
      />
    </div>
  );
}
