import { useMemo } from "react";
import type { TicketRecord } from "@/lib/api/types";
import { FormTemplateFileViewer } from "@/components/documents/FormTemplateFileViewer";
import { ViewOnlyDocumentViewer } from "@/components/documents/ViewOnlyDocumentViewer";
import { api } from "@/lib/api/client";
import { resolveFormPlacements } from "@/lib/placement-values";
import type { PortalSlot } from "@/lib/sessions";

type TicketSubmittedFileViewerProps = {
  ticket: TicketRecord;
  enabled?: boolean;
  className?: string;
  viewportClassName?: string;
  fileLabel?: string;
  fillHeight?: boolean;
  slot?: PortalSlot;
};

function populatedForm(ticket: TicketRecord) {
  return typeof ticket.formId === "object" && ticket.formId !== null ? ticket.formId : null;
}

/**
 * Shows the client's submitted form with answers.
 * Uses the same CSS placement overlay as Form Builder / Records / Client
 * so font size and positions match everywhere.
 */
export function TicketSubmittedFileViewer({
  ticket,
  enabled = true,
  className,
  viewportClassName,
  fileLabel,
  fillHeight,
  slot,
}: TicketSubmittedFileViewerProps) {
  const form = populatedForm(ticket);
  const templateSrc = form?.printTemplateImagePath?.trim() ?? null;
  const placements = useMemo(() => (form ? resolveFormPlacements(form) : []), [form]);
  const hasPlacements = Boolean(form && templateSrc && placements.length > 0);

  const workProcedurePath = form?.workProcedurePath?.trim() ?? "";
  const hasWorkProcedure = Boolean(workProcedurePath);

  const attachment = ticket.attachmentUrl?.trim() || null;
  const fallbackSrc = attachment || templateSrc;

  const blobLoader = useMemo(() => {
    if (hasPlacements || fallbackSrc || !ticket._id || !enabled) return undefined;
    return () => api.getTicketDocument(ticket._id, slot);
  }, [hasPlacements, fallbackSrc, ticket._id, enabled, slot]);

  const alt =
    fileLabel?.trim() ||
    ticket.attachmentName?.trim() ||
    ticket.formTitle ||
    ticket.ticketNumber ||
    "Submitted request";

  const displayLabel =
    hasWorkProcedure && form?.workProcedureName?.trim()
      ? `${alt} + ${form.workProcedureName.trim()}`
      : hasWorkProcedure
        ? `${alt} + supporting document`
        : alt;

  if (hasPlacements && form) {
    const answers = { ...(ticket.answers ?? {}) };
    // Older tickets may lack profile fields when PAMANA staffinformations was broken.
    const email = String(answers["{{prof_email}}"] ?? "").trim();
    if (!email && ticket.creatorEmail?.trim()) {
      answers["{{prof_email}}"] = ticket.creatorEmail.trim();
    }
    const division = String(answers["{{prof_division}}"] ?? "").trim();
    if (!division && ticket.division?.trim()) {
      answers["{{prof_division}}"] = ticket.division.trim();
    }

    return (
      <FormTemplateFileViewer
        form={form}
        enabled={enabled}
        className={className}
        viewportClassName={viewportClassName}
        fillHeight={fillHeight}
        fileLabel={displayLabel}
        answers={answers}
        emptyMessage="No uploaded file is attached to this request."
      />
    );
  }

  return (
    <ViewOnlyDocumentViewer
      src={fallbackSrc}
      blobLoader={blobLoader}
      enabled={enabled}
      alt={alt}
      fileLabel={displayLabel}
      className={className}
      viewportClassName={viewportClassName}
      fillHeight={fillHeight}
      emptyMessage="No uploaded file is attached to this request."
    />
  );
}
