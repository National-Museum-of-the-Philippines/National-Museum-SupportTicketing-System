import { Link } from "@tanstack/react-router";
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
import type { PortalSlot } from "@/lib/sessions";
import { ticketNeedsFeedback, ticketReadyToClose, ticketCanMarkComplete } from "@/lib/ticket-workflow";
import { cn, formatAssignedPersonnel } from "@/lib/utils";

/**
 * "My Requests" — the signed-in person's own TA requests as requestor.
 * Shared by every portal (Admin, Records, Super Admin, Staff/Client).
 */
export function MyRequestsListPage({
  slot,
  canQuery,
  submitPath,
  detailPath,
  description = "Your own support request submissions. Use this when you need assistance as a requestor.",
}: {
  slot: PortalSlot;
  canQuery: boolean;
  submitPath: string;
  detailPath: (ticketId: string) => string;
  description?: string;
}) {
  const [viewTicket, setViewTicket] = useState<{ id: string; number: string } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets", slot],
    queryFn: () => api.myTickets(slot),
    enabled: canQuery,
  });

  const items = data?.items ?? [];
  const head = (
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
  );

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="My Requests"
        description={description}
        actions={<ActionLink to={submitPath}>New request</ActionLink>}
      />

      <DataPanel title={`${items.length} request${items.length === 1 ? "" : "s"}`}>
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              {head}
              <tbody>
                <LoadingRows />
              </tbody>
            </table>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No personal requests yet."
            description="Submit a TA request for yourself — it will appear here."
            action={<ActionLink to={submitPath}>Submit request</ActionLink>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              {head}
              <tbody>
                {items.map((t) => {
                  const detail = detailPath(t._id);
                  const nextStep = ticketCanMarkComplete(t)
                    ? "Mark complete →"
                    : ticketNeedsFeedback(t)
                      ? "Submit feedback →"
                      : ticketReadyToClose(t)
                        ? "Close request →"
                        : null;
                  return (
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
                          {nextStep ? (
                            <Link to={detail} className="text-sm font-medium text-maroon hover:underline">
                              {nextStep}
                            </Link>
                          ) : (
                            <Link
                              to={detail}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shadow-sm")}
                            >
                              View details
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        slot={slot}
      />
    </div>
  );
}
