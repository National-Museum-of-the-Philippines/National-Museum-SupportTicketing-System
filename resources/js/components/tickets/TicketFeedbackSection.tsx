import { ExternalLink, MessageSquare } from "lucide-react";
import type { TicketRecord } from "@/lib/api/types";
import { DataPanel } from "@/components/layout/workspace-ui";
import { getClientFeedbackUrl } from "@/lib/feedback-config";

type TicketFeedbackSectionProps = {
  ticket: TicketRecord;
};

/** Admin / records view — client feedback after service. */
export function TicketFeedbackSection({ ticket }: TicketFeedbackSectionProps) {
  const feedbackUrl = getClientFeedbackUrl(ticket);

  if (ticket.feedbackSubmitted) {
    return (
      <DataPanel title="Client feedback">
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Submitted after service completion.
          </div>
          {ticket.feedbackRating ? (
            <p className="text-sm">
              <span className="font-medium text-foreground">Rating:</span> {ticket.feedbackRating}/5
            </p>
          ) : null}
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Comment
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {ticket.feedbackComment?.trim() || "No written comment provided."}
            </p>
          </div>
        </div>
      </DataPanel>
    );
  }

  if (ticket.status === "resolved" || ticket.status === "closed") {
    return (
      <DataPanel title="Client feedback">
        <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
          {ticket.status === "resolved"
            ? "Waiting for the client to complete the external feedback form."
            : "No feedback was recorded for this request."}
          {feedbackUrl ? (
            <>
              {" "}
              Client form:{" "}
              <a
                href={feedbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-maroon hover:underline"
              >
                Open feedback link
              </a>
            </>
          ) : null}
        </p>
      </DataPanel>
    );
  }

  return null;
}
