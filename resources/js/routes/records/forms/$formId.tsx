import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ActionPanel,
  BackLink,
  DataPanel,
  EmptyState,
  FlowNotice,
  FormStatusBadge,
  PageLoader,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { FormUploadedFileViewer } from "@/components/records/FormUploadedFileViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { FormReviewDecision } from "@/lib/api/types";
import { RECORDS_PENDING, RECORDS_PUBLISHED } from "@/lib/navigation";
import { useRecordsSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/records/forms/$formId")({
  component: FormReviewPage,
});

function FormReviewPage() {
  const { formId } = Route.useParams();
  const { canQuery } = useRecordsSession();
  const qc = useQueryClient();
  const [decision, setDecision] = useState<FormReviewDecision>("approved");
  const [remarks, setRemarks] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["form-review", formId],
    queryFn: () => api.getRecordsForm(formId),
    enabled: canQuery,
  });

  const review = useMutation({
    mutationFn: () => api.reviewForm(formId, { decision, remarks: remarks.trim() || undefined }),
    onSuccess: (res) => {
      const outcome = res.form.status === "published" ? "published" : "returned to admin";
      toast.success(`Form ${outcome}`);
      void qc.invalidateQueries({ queryKey: ["form-review", formId] });
      void qc.invalidateQueries({ queryKey: ["records-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["records-pending"] });
      void qc.invalidateQueries({ queryKey: ["records-published"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const form = data?.form;
  const canReview = form?.status === "pending_review";

  if (isLoading) {
    return <PageLoader label="Loading form review…" />;
  }

  if (!form) {
    return (
      <EmptyState
        title="Form not found"
        description="This form may have been removed or you may not have access."
        action={
          <BackLink to={RECORDS_PENDING} label="Back to pending forms" />
        }
      />
    );
  }

  return (
    <div className="page-shell">
      <BackLink to={RECORDS_PENDING} label="Back to pending forms" />

      <WorkspacePageHeader
        bordered={false}
        title={form.title}
        description={`${form.refNumber} · ${form.version} · Submitted by ${form.createdBy?.name ?? "Admin"}`}
        meta={<FormStatusBadge status={form.status} />}
      />

      {!canReview ? (
        <FlowNotice tone="warning" title="Review already completed">
          {form.status === "published" ? (
            <>
              This form was already approved and published.{" "}
              <Link to={RECORDS_PUBLISHED} className="font-medium underline">
                View published forms
              </Link>
            </>
          ) : form.status === "disapproved" ? (
            <>This form was already returned to Admin for revision.</>
          ) : (
            <>This form is not awaiting review.</>
          )}{" "}
          <button type="button" onClick={() => void refetch()} className="ml-1 font-medium underline">
            Refresh
          </button>
        </FlowNotice>
      ) : null}

      <DataPanel
        title="Form template"
        description="Uploaded by Admin. Zoom and scroll to review. View only."
      >
        <div className="bg-muted/30 p-4 sm:p-5">
          <div className="mx-auto max-w-3xl overflow-visible rounded-xl border border-border/80 bg-card shadow-sm">
            <FormUploadedFileViewer form={form} />
          </div>
        </div>
      </DataPanel>

      {canReview ? (
        <ActionPanel
          title="Recommendation"
          description="After reviewing the uploaded file above, choose Approve & publish or Disapprove with remarks."
        >
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 text-sm">
              <input
                type="radio"
                name="decision"
                checked={decision === "approved"}
                onChange={() => setDecision("approved")}
              />
              Approve & publish
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 text-sm">
              <input
                type="radio"
                name="decision"
                checked={decision === "disapproved"}
                onChange={() => setDecision("disapproved")}
              />
              Disapprove
            </label>
          </div>
          {decision === "disapproved" ? (
            <Input
              placeholder="Remarks (e.g. Please add required fields)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          ) : null}
          <div className="flex justify-end pt-0.5">
            <Button
              size="sm"
              className="w-fit"
              disabled={
                review.isPending ||
                review.isSuccess ||
                (decision === "disapproved" && !remarks.trim())
              }
              onClick={() => {
                if (review.isPending || review.isSuccess) return;
                review.mutate();
              }}
            >
              {review.isPending
                ? "Submitting…"
                : review.isSuccess
                  ? "Submitted — redirecting…"
                  : "Submit recommendation"}
            </Button>
          </div>
          {review.isSuccess ? (
            <FlowNotice tone="success" title="Recommendation submitted">
              Redirecting to pending list…{" "}
              <Link to={RECORDS_PENDING} className="font-medium underline">
                Back to pending list
              </Link>
            </FlowNotice>
          ) : null}
        </ActionPanel>
      ) : null}
    </div>
  );
}
