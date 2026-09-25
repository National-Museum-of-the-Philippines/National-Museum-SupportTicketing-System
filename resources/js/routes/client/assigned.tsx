import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useState } from "react";
import {
  DataPanel,
  EmptyState,
  LoadingRows,
  StatusBadge,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { TicketPdfViewerDialog } from "@/components/tickets/TicketPdfViewerDialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/client/assigned")({
  component: ClientAssignedRequestsPage,
});

function ClientAssignedRequestsPage() {
  const { user, sessionReady } = useAuth();
  const canQuery = sessionReady && Boolean(user);
  const [viewTicket, setViewTicket] = useState<{ id: string; number: string } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["assigned-tickets"],
    queryFn: () => api.listAssignedTickets("client"),
    enabled: canQuery,
  });

  const items = data?.items ?? [];

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Assigned to me"
        description="Requests an admin assigned to you. This is not My Requests (those are tickets you submitted)."
      />

      <DataPanel title={`${items.length} active assignment${items.length === 1 ? "" : "s"}`}>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-4 py-3 sm:px-5">Ticket</th>
                <th className="px-4 py-3 sm:px-5">Client</th>
                <th className="px-4 py-3 sm:px-5">Status</th>
                <th className="px-4 py-3 sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {!canQuery || isLoading ? (
                <LoadingRows cols={4} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      title="No assigned requests"
                      description="When an admin assigns you to a request, it will appear on this page."
                    />
                  </td>
                </tr>
              ) : (
                items.map((t) => (
                  <tr key={t._id} className="border-t border-border/70">
                    <td className="px-4 py-3.5 sm:px-5">
                      <Link
                        to="/client/requests/$ticketId"
                        params={{ ticketId: t._id }}
                        className="font-medium text-maroon hover:underline"
                      >
                        {t.ticketNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{t.formTitle}</p>
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">{t.creatorName}</td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewTicket({ id: t._id, number: t.ticketNumber })}
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          View file
                        </Button>
                        <Link
                          to="/client/requests/$ticketId"
                          params={{ ticketId: t._id }}
                          className="text-sm font-medium text-maroon hover:underline"
                        >
                          Open →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataPanel>

      <TicketPdfViewerDialog
        ticketId={viewTicket?.id ?? null}
        ticketNumber={viewTicket?.number}
        open={Boolean(viewTicket)}
        onOpenChange={(open) => {
          if (!open) setViewTicket(null);
        }}
        slot="client"
      />
    </div>
  );
}
