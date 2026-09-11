import { createFileRoute, Link } from "@tanstack/react-router";
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
import { ADMIN_REQUESTS } from "@/lib/navigation";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/admin/approvals")({
  component: ApprovalsPage,
});

type PendingTicketsData = {
  items: TicketRecord[];
  total: number;
  pendingCount: number;
};

function isReadyToAssign(ticket: TicketRecord): boolean {
  return ticket.processOwnerPhase === "assignment";
}

function patchPendingTicket(qc: ReturnType<typeof useQueryClient>, ticket: TicketRecord) {
  const apply = (old: PendingTicketsData | undefined) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((item) => (item._id === ticket._id ? { ...item, ...ticket } : item)),
    };
  };
  qc.setQueryData<PendingTicketsData>(["pending-tickets"], apply);
  qc.setQueryData<PendingTicketsData>(["admin-tickets-pending"], apply);
}

function markReadyToAssign(qc: ReturnType<typeof useQueryClient>, ticketId: string) {
  const apply = (old: PendingTicketsData | undefined) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((item) =>
        item._id === ticketId ? { ...item, processOwnerPhase: "assignment" as const } : item,
      ),
    };
  };
  qc.setQueryData<PendingTicketsData>(["pending-tickets"], apply);
  qc.setQueryData<PendingTicketsData>(["admin-tickets-pending"], apply);
}

function invalidateAdminTicketQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["pending-tickets"] });
  void qc.invalidateQueries({ queryKey: ["admin-tickets-pending"] });
  void qc.invalidateQueries({ queryKey: ["all-tickets"] });
}

function ApprovalsPage() {
  const qc = useQueryClient();
  const { canQuery } = useAdminSession();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["pending-tickets"],
    queryFn: () => api.listTickets({ status: "pending_approval" }, "admin"),
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
        : "Could not load pending approvals.";

  const approve = useMutation({
    mutationFn: (id: string) => api.approveTicket(id, "admin"),
    onSuccess: (res) => {
      const ticket = res.ticket;
      if (ticket) patchPendingTicket(qc, ticket);
      toast.success(
        ticket?.processOwnerPhase === "assignment"
          ? "Approved — ready for task assignment"
          : "Request approved",
      );
      invalidateAdminTicketQueries(qc);
    },
    onError: (err: Error, id) => {
      const message = err instanceof ApiError ? err.message : "Could not approve request.";
      if (/ready for task assignment/i.test(message)) {
        markReadyToAssign(qc, id);
        toast.info("Already approved — assign personnel next");
        invalidateAdminTicketQueries(qc);
        return;
      }
      toast.error(message);
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, reason: rejectionReason }: { id: string; reason: string }) =>
      api.rejectTicket(id, rejectionReason, "admin"),
    onSuccess: () => {
      toast.success("Request rejected");
      setRejectId(null);
      setReason("");
      invalidateAdminTicketQueries(qc);
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
        title="Approvals"
        description="Review client technical assistance requests before assignment and processing."
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
          title="Could not load approvals"
          action={
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        >
          {errorMessage}
        </FlowNotice>
      ) : null}

      <DataPanel title={`${items.length} pending approval${items.length === 1 ? "" : "s"}`}>
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
                      title="No pending approvals"
                      description="New client requests will appear here for your review."
                    />
                  </td>
                </tr>
              ) : (
                items.map((t) => (
                  <tr key={t._id} className="border-t border-border/70">
                    <td className="px-4 py-3.5 sm:px-5">
                      <Link
                        to="/admin/requests/$ticketId"
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
                          <Button size="sm" asChild>
                            <Link to="/admin/requests/$ticketId" params={{ ticketId: t._id }}>
                              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                              Assign
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => approve.mutate(t._id)}
                            disabled={approve.isPending || reject.isPending}
                          >
                            {approve.isPending && approve.variables === t._id ? "Approving…" : "Approve"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectId(t._id)}
                          disabled={approve.isPending || reject.isPending}
                        >
                          Reject
                        </Button>
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

      <Link to={ADMIN_REQUESTS} className="text-sm text-maroon hover:underline">
        View all requests →
      </Link>

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
