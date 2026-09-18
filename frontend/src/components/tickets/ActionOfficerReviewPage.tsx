import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  ActionPanel,
  DataPanel,
  EmptyState,
  FlowNotice,
  LoadingRows,
  StatusBadge,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { TicketPdfViewerDialog } from "@/components/tickets/TicketPdfViewerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";
import type { TicketRecord } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { CLIENT_REQUESTS, isAdminRole } from "@/lib/navigation";

function isReadyToAssign(ticket: TicketRecord): boolean {
  return ticket.processOwnerPhase === "assignment";
}

function invalidateQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["review-action-officer"] });
  void qc.invalidateQueries({ queryKey: ["review-recommending"] });
  void qc.invalidateQueries({ queryKey: ["review-supervisor"] });
  void qc.invalidateQueries({ queryKey: ["my-tickets"] });
}

export function ActionOfficerReviewPage() {
  const qc = useQueryClient();
  const { user, sessionReady } = useAuth();
  const canQuery = sessionReady && Boolean(user);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["review-action-officer"],
    queryFn: () => api.listClientReview("action_officer", "client"),
    enabled: canQuery,
  });
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [viewTicket, setViewTicket] = useState<{ id: string; number: string } | null>(null);

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Could not load Action Officer queue.";

  const approve = useMutation({
    mutationFn: (id: string) => api.approveTicket(id, "client"),
    onSuccess: (res) => {
      toast.success(
        res.ticket?.processOwnerPhase === "assignment"
          ? "Approved — ready for task assignment"
          : "Request approved",
      );
      invalidateQueries(qc);
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not approve request.");
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, reason: rejectionReason }: { id: string; reason: string }) =>
      api.rejectTicket(id, rejectionReason, "client"),
    onSuccess: () => {
      toast.success("Request rejected");
      setRejectId(null);
      setReason("");
      invalidateQueries(qc);
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not reject request.");
    },
  });

  const items = data?.items ?? [];
  const rejectTarget = items.find((t) => t._id === rejectId);

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="For Review — Action Officer"
        description="Approve requests that have completed recommending/supervisor review. Sequential Action Officers, then Request Management assignment."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={!canQuery || isFetching}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      {isError ? (
        <FlowNotice
          tone="danger"
          title="Could not load Action Officer queue"
          action={
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        >
          {errorMessage}
        </FlowNotice>
      ) : null}

      <DataPanel title={`${items.length} for review`}>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-4 py-3 sm:px-5">Ticket</th>
                <th className="px-4 py-3 sm:px-5">Client</th>
                <th className="px-4 py-3 sm:px-5">Division</th>
                <th className="px-4 py-3 sm:px-5">Status</th>
                <th className="px-4 py-3 sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {!canQuery || isLoading ? (
                <LoadingRows cols={5} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="Nothing to review"
                      description="Requests reach this queue after recommending and supervisor approval, when it is your Action Officer step."
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
                    <td className="px-4 py-3.5 sm:px-5">{t.division || "—"}</td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <StatusBadge
                        status={t.status}
                        label={isReadyToAssign(t) ? "Ready to assign" : undefined}
                      />
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewTicket({ id: t._id, number: t.ticketNumber })}
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          View file
                        </Button>
                        {isReadyToAssign(t) ? (
                          isAdminRole(user?.role) ? (
                            <Button size="sm" asChild>
                              <Link to="/admin/requests/$ticketId" params={{ ticketId: t._id }}>
                                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                                Assign
                              </Link>
                            </Button>
                          ) : (
                            <span className="self-center text-xs text-muted-foreground">
                              Assign personnel in Admin → Request Management
                            </span>
                          )
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => approve.mutate(t._id)}
                            disabled={approve.isPending || reject.isPending}
                          >
                            {approve.isPending && approve.variables === t._id ? "Approving…" : "Approve"}
                          </Button>
                        )}
                        {isReadyToAssign(t) ? null : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRejectId(t._id)}
                            disabled={approve.isPending || reject.isPending}
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataPanel>

      {rejectId ? (
        <ActionPanel
          title="Reject request"
          description={
            rejectTarget
              ? `${rejectTarget.formTitle} · ${rejectTarget.ticketNumber}`
              : "Provide a clear reason for the client."
          }
        >
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => reject.mutate({ id: rejectId, reason })}
              disabled={!reason.trim() || reject.isPending}
            >
              Confirm reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
          </div>
        </ActionPanel>
      ) : null}

      <Link to={CLIENT_REQUESTS} className="text-sm text-maroon hover:underline">
        View my requests →
      </Link>

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
