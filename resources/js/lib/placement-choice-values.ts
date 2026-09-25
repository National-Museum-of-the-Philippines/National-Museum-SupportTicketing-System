import type { FormField } from "@/lib/form-builder-store";
import type { LiveFormField } from "@/lib/api/types";

type ChoiceField = Pick<FormField | LiveFormField, "type" | "label" | "options">;

export const PLACEMENT_CHECKMARK = "✓";

/** Placeable label for the underscore line beside an Others option. */
export function othersBlankPlacementLabel(option: string): string {
  return `${option.trim()} (blank)`;
}

export function isOthersOptionLabel(label: string): boolean {
  return /^others?$/i.test(label.trim());
}

/** True when this marker is the blank line next to Others (not the checkbox). */
export function isOthersBlankPlacementLabel(placementLabel: string): boolean {
  return /^others?\s*\(\s*blank\s*\)$/i.test(placementLabel.trim());
}

function normalizeOption(value: string): string {
  return value.trim().toLowerCase();
}

export function isChoiceFieldType(type: string): boolean {
  return type === "checkbox" || type === "radio";
}

/** Map a placement label to a field option, when this marker targets one checkbox/radio box. */
export function resolvePlacementOption(field: ChoiceField, placementLabel: string): string | null {
  if (!isChoiceFieldType(field.type)) return null;

  const options = field.options ?? [];
  if (options.length === 0) return null;

  const label = placementLabel.trim();
  if (!label) return null;

  // Blank-line markers are not checkbox targets.
  if (isOthersBlankPlacementLabel(label)) return null;

  const exact = options.find((option) => option === label);
  if (exact) return exact;

  const caseInsensitive = options.find(
    (option) => normalizeOption(option) === normalizeOption(label),
  );
  if (caseInsensitive) return caseInsensitive;

  // Whole-field marker (legacy) — not tied to a single box.
  if (normalizeOption(label) === normalizeOption(field.label)) return null;

  return null;
}

export function isChoiceOptionSelected(value: unknown, option: string): boolean {
  const target = normalizeOption(option);
  const isOthersOption = /^others?$/.test(target);

  if (Array.isArray(value)) {
    return value.some((item) => {
      const text = String(item);
      if (normalizeOption(text) === target) return true;
      if (isOthersOption && (/^others?\s*:/i.test(text) || /^others?$/i.test(text))) return true;
      return false;
    });
  }

  if (value === true || value === "true") return target === "yes";
  if (value === false || value === "false") return false;

  return normalizeOption(String(value)) === target;
}

/** Extract typed Others detail from checkbox answers (`Others: detail`). */
export function extractOthersDetail(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = String(item);
      const match = text.match(/^others?\s*:\s*(.+)$/i);
      if (match?.[1]?.trim()) return match[1].trim();
    }
    return "";
  }
  if (typeof value === "string") {
    const match = value.match(/^others?\s*:\s*(.+)$/i);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

/**
 * Checkmark for a specific option placement, typed text for Others blank line,
 * empty when unchecked, null = use default text formatting.
 */
export function displayValueForChoicePlacement(
  field: ChoiceField,
  placementLabel: string,
  value: unknown,
  showMarkerWhenEmpty = false,
): string | null {
  if (!isChoiceFieldType(field.type)) return null;

  // Blank beside Others → typed word only (never the checkmark).
  if (isOthersBlankPlacementLabel(placementLabel)) {
    const hasOthers = (field.options ?? []).some((option) => isOthersOptionLabel(option));
    if (!hasOthers) return "";
    const detail = extractOthersDetail(value);
    if (detail) return detail;
    return showMarkerWhenEmpty ? "…" : "";
  }

  const option = resolvePlacementOption(field, placementLabel);
  if (!option) {
    // Not an option-box marker — let the caller use the field/label fallback.
    return null;
  }

  // Others checkbox → checkmark only; detail goes on the blank placement.
  if (isChoiceOptionSelected(value, option)) return PLACEMENT_CHECKMARK;
  if (showMarkerWhenEmpty) return PLACEMENT_CHECKMARK;
  return "";
}
