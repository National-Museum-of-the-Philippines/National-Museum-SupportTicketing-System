import type { FormDraft } from "@/lib/form-builder-store";
import { FORM_BUILDER_STEPS, type FormBuilderStepKey } from "./constants";

export function validateFormBuilderStep(step: FormBuilderStepKey, draft: FormDraft): string | null {
  switch (step) {
    case "general":
      if (!draft.title.trim()) return "Enter a form title before continuing.";
      if (!draft.effectivity) return "Choose a date effectivity before continuing.";
      return null;
    case "fields":
      if (draft.fields.length === 0) return "Add at least one form field before continuing.";
      return null;
    case "print":
      if (!draft.printTemplateImagePath?.trim() && !draft.printTemplateImage) {
        return "Upload a form template before continuing.";
      }
      if ((draft.printPlacements?.length ?? 0) === 0) {
        return "Place at least one field on the template before continuing.";
      }
      return null;
    case "clientApproval":
      return null;
    case "processOwner": {
      const selected = (draft.actionOfficers ?? []).filter((o) => o.userId?.trim());
      if (selected.length < 1) {
        return "Select at least one Action Officer before continuing.";
      }
      return null;
    }
    case "procedure":
      return null;
    default:
      return null;
  }
}

export function validateFormBuilderStepsUntil(
  draft: FormDraft,
  fromIdx: number,
  toIdx: number,
): string | null {
  for (let i = fromIdx; i < toIdx; i++) {
    const err = validateFormBuilderStep(FORM_BUILDER_STEPS[i].key, draft);
    if (err) return err;
  }
  return null;
}
