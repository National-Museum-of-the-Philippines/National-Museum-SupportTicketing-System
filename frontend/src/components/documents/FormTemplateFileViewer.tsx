import { useMemo } from "react";
import type { FormRecord, LiveFormField } from "@/lib/api/types";
import { buildPlacementOverlay } from "@/components/documents/buildPlacementOverlay";
import { EmptyState } from "@/components/layout/workspace-ui";
import { ViewOnlyDocumentViewer } from "@/components/documents/ViewOnlyDocumentViewer";
import { DEFAULT_PROFILE_PLACEMENT_FIELDS } from "@/lib/profile-placement-fields";
import {
  resolveFormPlacementFontSize,
  resolveFormPlacements,
} from "@/lib/placement-values";

type FormTemplateFileViewerProps = {
  form: FormRecord;
  enabled?: boolean;
  className?: string;
  viewportClassName?: string;
  fillHeight?: boolean;
  fileLabel?: string;
  emptyMessage?: string;
  /** Live or submitted answers — painted on the same mapped spots Admin saved. */
  answers?: Record<string, unknown>;
  /**
   * Show every mapped marker the way Form Builder does (labels / ✓) when a slot
   * has no answer yet. Client + Records template review should pass true so
   * nothing Admin mapped disappears.
   */
  showMappedPlaceholders?: boolean;
};

function withProfileFields(fields: LiveFormField[]): LiveFormField[] {
  const existing = new Set(
    fields.map((field) => field.variable.replace(/^\{\{|\}\}$/g, "")),
  );
  const extras: LiveFormField[] = [];
  for (const profile of DEFAULT_PROFILE_PLACEMENT_FIELDS) {
    const inner = profile.variable.replace(/^\{\{|\}\}$/g, "");
    if (existing.has(inner)) continue;
    extras.push({
      id: `profile_${inner}`,
      type: "textbox",
      variable: profile.variable,
      label: profile.label,
    });
  }
  return extras.length ? [...fields, ...extras] : fields;
}

/**
 * Uploaded template + field placements.
 * Exact same left/top % and CSS canvas as Form Builder — no position auto-adjust.
 */
export function FormTemplateFileViewer({
  form,
  enabled = true,
  className,
  viewportClassName,
  fillHeight,
  fileLabel = "Form template",
  emptyMessage = "No form file was uploaded.",
  answers,
  showMappedPlaceholders,
}: FormTemplateFileViewerProps) {
  const templateSrc = form.printTemplateImagePath?.trim() ?? null;
  const placements = useMemo(() => resolveFormPlacements(form), [form]);
  const fields = useMemo(() => withProfileFields(form.fields ?? []), [form.fields]);
  const placementFontSize = resolveFormPlacementFontSize(form);
  const hasPlacements = placements.length > 0;
  const layoutPreview = showMappedPlaceholders ?? answers === undefined;

  const overlayPaintKey = useMemo(() => {
    if (!answers) return "none";
    const profile = DEFAULT_PROFILE_PLACEMENT_FIELDS.map((field) =>
      String(answers[field.variable] ?? ""),
    ).join("|");
    const signatures = Object.entries(answers)
      .filter(
        ([, value]) =>
          typeof value === "string" &&
          (value.startsWith("data:image/") || value.includes("/uploads/")),
      )
      .map(([key, value]) => `${key}:${String(value).length}`)
      .join("|");
    return `${profile}::${signatures}`;
  }, [answers]);

  const overlay = useMemo(() => {
    if (!hasPlacements) return undefined;
    return (
      buildPlacementOverlay(fields, placements, answers ?? {}, placementFontSize, {
        showLabelWhenEmpty: true,
        emptyChoiceAsCheckmark: layoutPreview,
      }) ?? <div className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
    );
  }, [fields, hasPlacements, answers, placements, placementFontSize, layoutPreview]);

  if (!templateSrc) {
    return <EmptyState title="No template uploaded" description={emptyMessage} />;
  }

  return (
    <ViewOnlyDocumentViewer
      key={`form-viewer-${form._id}-${overlayPaintKey}`}
      src={templateSrc}
      enabled={enabled}
      alt={fileLabel}
      fileLabel={fileLabel}
      overlay={overlay}
      placementFontSize={placementFontSize}
      className={className}
      viewportClassName={viewportClassName}
      fillHeight={fillHeight}
      emptyMessage={emptyMessage}
    />
  );
}
