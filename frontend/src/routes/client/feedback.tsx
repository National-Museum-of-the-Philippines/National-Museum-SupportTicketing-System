import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ClientFeedbackPanel } from "@/components/client/ClientFeedbackPanel";
import {
  ActionLink,
  DataPanel,
  EmptyState,
  FlowNotice,
  ListRow,
  PageLoader,
  StatusBadge,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { api } from "@/lib/api/client";
import { isClientFeedbackConfigured } from "@/lib/feedback-config";
import { CLIENT_REQUESTS } from "@/lib/navigation";
import { ticketNeedsFeedback, ticketReadyToClose } from "@/lib/ticket-workflow";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/feedback")({
  component: ClientFeedbackPage,
});

function FeedbackTicketCard({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["my-ticket", ticketId],
    queryFn: () => api.getTicket(ticketId),
  });
  const ticket = data?.ticket;

  const feedback = useMutation({
    mutationFn: () => api.submitFeedback(ticketId, { comment: comment.trim() || undefined }),
    onSuccess: () => {
      toast.success("Feedback recorded — you can now close this request");
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
      void qc.invalidateQueries({ queryKey: ["my-ticket", ticketId] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not record feedback"),
  });

  if (isLoading) {
    return (
      <article className="feedback-ticket-card">
        <PageLoader label="Loading request…" />
      </article>
    );
  }

  if (!ticket || !ticketNeedsFeedback(ticket)) return null;

  return (
    <article className="feedback-ticket-card">
      <header className="feedback-ticket-header">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</p>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground">{ticket.formTitle}</h3>
        </div>
        <StatusBadge status={ticket.status} />
      </header>
      <div className="feedback-ticket-body">
        <ClientFeedbackPanel
          ticket={ticket}
          comment={comment}
          onCommentChange={setComment}
          onConfirm={() => feedback.mutate()}
          isPending={feedback.isPending}
        />
      </div>
    </article>
  );
}

function ClientFeedbackPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => api.myTickets(),
  });

  const items = data?.items ?? [];
  const awaitingFeedback = items.filter(ticketNeedsFeedback);
  const readyToClose = items.filter(ticketReadyToClose);

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Service Feedback"
        description="After your request is completed, fill out the official satisfaction survey, then confirm here."
        actions={<ActionLink to={CLIENT_REQUESTS} variant="outline">My requests</ActionLink>}
      />

      {!isClientFeedbackConfigured() ? (
        <FlowNotice tone="warning" title="Feedback link not configured">
          Ask your administrator to set <code className="text-xs">VITE_CLIENT_FEEDBACK_URL</code> in the
          frontend environment.
        </FlowNotice>
      ) : null}

      {awaitingFeedback.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Awaiting feedback
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-maroon/10 px-1.5 text-xs font-bold text-maroon">
                {awaitingFeedback.length}
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="feedback-ticket-card">
              <PageLoader label="Loading requests…" />
            </div>
          ) : (
            <div className="feedback-ticket-list grid gap-3">
              {awaitingFeedback.map((t) => (
                <FeedbackTicketCard key={t._id} ticketId={t._id} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <DataPanel title="Awaiting feedback">
          {isLoading ? (
            <PageLoader label="Loading requests…" />
          ) : (
            <EmptyState
              title="No feedback pending."
              description="When you mark a service complete, the request will appear here for survey confirmation."
              action={<ActionLink to={CLIENT_REQUESTS}>View my requests</ActionLink>}
            />
          )}
        </DataPanel>
      )}

      {readyToClose.length > 0 ? (
        <DataPanel title={`Ready to close (${readyToClose.length})`}>
          <FlowNotice tone="success" title="Feedback confirmed">
            Open each request below and click <strong>Close ticket</strong> when you are satisfied.
          </FlowNotice>
          <ul className="divide-y divide-border/80">
            {readyToClose.map((t) => (
              <ListRow
                key={t._id}
                title={t.formTitle}
                subtitle={t.ticketNumber}
                action={
                  <Link
                    to="/client/requests/$ticketId"
                    params={{ ticketId: t._id }}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shadow-sm")}
                  >
                    Close request
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
            ))}
          </ul>
        </DataPanel>
      ) : null}
    </div>
  );
}
