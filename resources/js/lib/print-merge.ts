import type { FormField } from "@/lib/form-builder-store";

/** Matches `{{txt01}}`, `{{drp01}}`, etc. */
const VARIABLE_TOKEN = /\{\{[^}]+\}\}/g;

/**
 * Replaces every `{{variable}}` token with the value from `values` (key = full token e.g. `{{txt01}}`).
 * Unknown tokens become empty string so they never appear on printed output.
 */
export function mergeTemplateWithValues(template: string, values: Record<string, string>): string {
  if (!template) return "";
  return template.replace(VARIABLE_TOKEN, (token) => {
    const v = values[token];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

const PLACEMENT_BLOCK = /\[(?:NMP|Folio) placements\][\s\S]*?\[\/(?:NMP|Folio) placements\]\s*/g;

/** Removes designer-only placement blocks before merge / print. */
export function stripDesignerPlacementBlock(template: string): string {
  return template.replace(PLACEMENT_BLOCK, "").trim();
}

function formatPreviewDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatPreviewTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sampleValueForField(f: FormField): string {
  switch (f.type) {
    case "dropdown":
      return (f.options && f.options[0]) || "—";
    case "checkbox":
      return f.options && f.options.length > 0 ? f.options.slice(0, 2).join(", ") : "—";
    case "radio":
      return (f.options && f.options[0]) || "—";
    // Date and time previews follow the day the form is created; clients pick their own values.
    case "date":
      return formatPreviewDate(new Date());
    case "time":
      return formatPreviewTime(new Date());
    case "datetime": {
      const now = new Date();
      return `${formatPreviewDate(now)} ${formatPreviewTime(now)}`;
    }
    // No made-up number: clients type their own when they fill in the form.
    case "number":
      return f.label || "Number";
    case "email":
      return "employee@example.gov.ph";
    case "file":
      return "attached-document.pdf";
    case "signature":
      return "(signature)";
    default:
      return f.label || "—";
  }
}

/** Short preview labels for the form builder canvas only — not used on submitted files. */
export function buildSampleSubmissionValues(fields: FormField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    map[f.variable] = sampleValueForField(f);
  }
  return map;
}

/** Final body text for printing: no designer blocks, no `{{}}` tokens. */
export function buildPrintReadyText(template: string, values: Record<string, string>): string {
  const cleaned = stripDesignerPlacementBlock(template);
  return mergeTemplateWithValues(cleaned, values);
}
