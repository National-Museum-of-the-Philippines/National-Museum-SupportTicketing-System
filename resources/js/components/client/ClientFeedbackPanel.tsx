import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import type { TicketRecord } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getClientFeedbackUrl, isClientFeedbackConfigured } from "@/lib/feedback-config";

type ClientFeedbackPanelProps = {
  ticket: TicketRecord;
  comment: string;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
  isPending?: boolean;
};

export function ClientFeedbackPanel({
  ticket,
  comment,
  onCommentChange,
  onConfirm,
  isPending = false,
}: ClientFeedbackPanelProps) {
  const feedbackUrl = getClientFeedbackUrl(ticket);

  if (!isClientFeedbackConfigured() || !feedbackUrl) {
    return (
      <p className="text-sm text-destructive">
        Feedback link is not configured. Ask your administrator to set{" "}
        <code className="text-xs">VITE_CLIENT_FEEDBACK_URL</code> in the frontend environment.
      </p>
    );
  }

  return (
    <ol className="feedback-steps">
      <li className="feedback-step">
        <span className="feedback-step-marker" aria-hidden>
          1
        </span>
        <div className="feedback-step-body">
          <p className="text-sm font-semibold text-foreground">Complete the official survey</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Opens in a new tab. Your ticket number is included automatically.
          </p>
          <Button asChild size="sm" className="mt-3 shadow-sm">
            <a href={feedbackUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open Client Satisfaction Survey
            </a>
          </Button>
        </div>
      </li>

      <li className="feedback-step">
        <span className="feedback-step-marker" aria-hidden>
          2
        </span>
        <div className="feedback-step-body">
          <p className="text-sm font-semibold text-foreground">Confirm when you&apos;re done</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Add optional notes for admin, then confirm so you can close this request.
          </p>
          <div className="mt-3 space-y-2">
            <Label htmlFor={`feedback-comment-${ticket._id}`} className="text-xs">
              Notes for admin <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`feedback-comment-${ticket._id}`}
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="e.g. Survey reference or short summary"
              rows={2}
              className="min-h-[4.5rem] resize-none rounded-lg bg-background text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onConfirm}
            disabled={isPending}
            className="mt-3 shadow-sm"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            I&apos;ve submitted feedback
          </Button>
        </div>
      </li>
    </ol>
  );
}
