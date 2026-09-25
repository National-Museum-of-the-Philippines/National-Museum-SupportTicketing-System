import type { TicketRecord } from "@/lib/api/types";
import { DataPanel } from "@/components/layout/workspace-ui";
import { TicketSubmittedFileViewer } from "@/components/tickets/TicketSubmittedFileViewer";
import { TicketFeedbackSection } from "@/components/tickets/TicketFeedbackSection";
import { getTicketAnswerRows } from "@/lib/ticket-details";
import { cn, formatAssignedPersonnel } from "@/lib/utils";

type TicketRequestDetailsProps = {
  ticket: TicketRecord;
  className?: string;
  /** Show client feedback block (admin views). */
  showFeedback?: boolean;
};

export function TicketRequestDetails({
  ticket,
  className,
  showFeedback = true,
}: TicketRequestDetailsProps) {
  const answerRows = getTicketAnswerRows(ticket);
  const fileLabel = ticket.attachmentName?.trim() || ticket.formTitle;

  return (
    <div className={cn("space-y-4", className)}>
      <DataPanel
        title="Uploaded file"
        description="Form with submitted answers placed on the template. Zoom and scroll to review."
      >
        <TicketSubmittedFileViewer ticket={ticket} fileLabel={fileLabel} />
      </DataPanel>

      {answerRows.length > 0 ? (
        <DataPanel title="Submitted answers">
          <dl className="divide-y divide-border/70">
            {answerRows.map((row) => (
              <div
                key={row.label}
                className="answer-row grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:px-5"
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-sm">{row.value}</dd>
              </div>
            ))}
          </dl>
        </DataPanel>
      ) : null}

      {showFeedback ? <TicketFeedbackSection ticket={ticket} /> : null}

      <div className="form-panel">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Request details
        </h2>

        <dl className="detail-grid mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Form</dt>
            <dd className="mt-1 text-sm font-medium">{ticket.formTitle}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Submitted by</dt>
            <dd className="mt-1 text-sm font-medium">{ticket.creatorName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Division</dt>
            <dd className="mt-1 text-sm">{ticket.division || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Created</dt>
            <dd className="mt-1 text-sm">
              {new Date(ticket.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Assigned personnel</dt>
            <dd className="mt-1 text-sm font-medium">
              {formatAssignedPersonnel(ticket.assignedTo)}
            </dd>
          </div>
        </dl>

        {ticket.rejectionReason ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <strong>Rejected:</strong> {ticket.rejectionReason}
          </div>
        ) : null}
      </div>
    </div>
  );
}
