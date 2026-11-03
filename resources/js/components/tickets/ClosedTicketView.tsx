import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/layout/workspace-ui";
import { TicketSubmittedFileViewer } from "@/components/tickets/TicketSubmittedFileViewer";
import { api } from "@/lib/api/client";
import type { ActivityRecord, TicketRecord } from "@/lib/api/types";
import { ADMIN_REPORTS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const HISTORY_LABELS: Record<string, { label: string; dot: string }> = {
  ticket_created: { label: "Submitted", dot: "bg-stone-500" },
  ticket_assigned: { label: "Assigned", dot: "bg-maroon" },
  ticket_service_completed: { label: "Service completed", dot: "bg-amber-600" },
  feedback_submitted: { label: "Feedback submitted", dot: "bg-amber-600" },
  ticket_confirmed: { label: "Closed", dot: "bg-emerald-800" },
  ticket_reopened: { label: "Reopened", dot: "bg-red-600" },
  ticket_rejected: { label: "Rejected", dot: "bg-red-600" },
};

function historyEntry(row: ActivityRecord) {
  const known = HISTORY_LABELS[row.action];
  if (known) return known;
  if (row.action === "ticket_status_updated") {
    const status = row.summary.toLowerCase();
    if (status.includes("closed")) return { label: "Closed", dot: "bg-emerald-800" };
    return { label: "In progress", dot: "bg-amber-600" };
  }
  return {
    label: row.action.replace(/^ticket_/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
    dot: "bg-stone-400",
  };
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function Card({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border/80 bg-card p-6 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Read-only summary of a closed request: the filled-in form, client feedback and history. */
export function ClosedTicketView({ ticket }: { ticket: TicketRecord }) {
  const { data: history } = useQuery({
    queryKey: ["ticket-history", ticket._id],
    queryFn: () => api.ticketHistory(ticket._id, "admin"),
  });
  const rows = history?.items ?? [];
  const rating = Math.round(ticket.feedbackRating ?? 0);
  const handledBy = ticket.assignedTo?.map((u) => u.name).join(", ") || "Not assigned";
  const fileLabel = ticket.attachmentName?.trim() || ticket.formTitle;

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-3">
        <Link
          to={ADMIN_REPORTS}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to reports
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</p>
            <h1 className="mt-1 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {ticket.title || ticket.formTitle}
            </h1>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile label="Requested by" value={ticket.creatorName || "—"} />
        <InfoTile label="Submitted" value={formatDate(ticket.createdAt)} />
        <InfoTile label="Closed" value={formatDate(ticket.updatedAt)} />
        <InfoTile label="Handled by" value={handledBy} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <Card
          title="Submitted form"
          aside={
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Read only
            </span>
          }
        >
          <div className="overflow-hidden rounded-xl border border-border/70">
            <TicketSubmittedFileViewer ticket={ticket} fileLabel={fileLabel} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Client feedback">
            {ticket.feedbackSubmitted ? (
              <>
                {rating > 0 ? (
                  <div className="flex gap-1" role="img" aria-label={`${rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          "h-5 w-5",
                          n <= rating ? "fill-amber-600 text-amber-600" : "text-amber-600/60",
                        )}
                      />
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                  {ticket.feedbackComment?.trim() || "No written comment provided."}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">The client did not leave feedback.</p>
            )}
          </Card>

          <Card title="History">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history recorded.</p>
            ) : (
              <ol className="space-y-4">
                {rows.map((row) => {
                  const entry = historyEntry(row);
                  return (
                    <li key={row._id} className="flex gap-3">
                      <span className={cn("mt-1.5 h-3 w-3 shrink-0 rounded-full", entry.dot)} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(row.createdAt)} · {row.actorName || "System"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
