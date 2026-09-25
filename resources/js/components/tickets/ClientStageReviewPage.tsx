import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { CLIENT_REQUESTS } from "@/lib/navigation";

export type ClientReviewStage = "recommending" | "supervisor";

const STAGE_COPY: Record<
  ClientReviewStage,
  { title: string; description: string; empty: string; queryKey: string }
> = {
  recommending: {
    title: "For Review — Recommending Officer",
    description: "Endorse requests from your section before they go to the Immediate Supervisor.",
    empty: "No requests are waiting for your recommending endorsement.",
    queryKey: "review-recommending",
  },
  supervisor: {
    title: "For Review — Immediate Supervisor",
    description: "Review endorsed requests from your section before they go to Action Officers.",
    empty: "No requests are waiting for your immediate supervisor review.",
    queryKey: "review-supervisor",
  },
};

function invalidateReviewQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["review-recommending"] });
  void qc.invalidateQueries({ queryKey: ["review-supervisor"] });
  void qc.invalidateQueries({ queryKey: ["review-action-officer"] });
  void qc.invalidateQueries({ queryKey: ["my-tickets"] });
}

export function ClientStageReviewPage({ stage }: { stage: ClientReviewStage }) {
  const copy = STAGE_COPY[stage];
  const qc = useQueryClient();
  const { user, sessionReady } = useAuth();
  const canQuery = sessionReady && Boolean(user);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [copy.queryKey],
    queryFn: () => api.listClientReview(stage, "client"),
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
        : "Could not load requests for review.";

  const approve = useMutation({
    mutationFn: (id: string) => api.approveTicket(id, "client"),
    onSuccess: () => {
      toast.success(stage === "recommending" ? "Endorsed for supervisor review" : "Approved for Action Officers");
      invalidateReviewQueries(qc);
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
      invalidateReviewQueries(qc);
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
        title={copy.title}
        description={copy.description}
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
          title="Could not load review queue"
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
                    <EmptyState title="Nothing to review" description={copy.empty} />
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
                      <StatusBadge status={t.status} />
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
                        <Button
                          size="sm"
                          onClick={() => approve.mutate(t._id)}
                          disabled={approve.isPending || reject.isPending}
                        >
                          {approve.isPending && approve.variables === t._id ? "Approving…" : "Approve"}
                        </Button>
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
