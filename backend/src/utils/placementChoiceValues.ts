export const PLACEMENT_CHECKMARK = "✓";

function normalizeOption(value: string): string {
  return value.trim().toLowerCase();
}

export function isChoiceFieldType(type: string): boolean {
  return type === "checkbox" || type === "radio";
}

export function isOthersOptionLabel(label: string): boolean {
  return /^others?$/i.test(label.trim());
}

export function isOthersBlankPlacementLabel(placementLabel: string): boolean {
  return /^others?\s*\(\s*blank\s*\)$/i.test(placementLabel.trim());
}

export function resolvePlacementOption(
  field: { type: string; label: string; options?: string[] },
  placementLabel: string,
): string | null {
  if (!isChoiceFieldType(field.type)) return null;

  const options = field.options ?? [];
  if (options.length === 0) return null;

  const label = placementLabel.trim();
  if (!label) return null;

  if (isOthersBlankPlacementLabel(label)) return null;

  const exact = options.find((option) => option === label);
  if (exact) return exact;

  const caseInsensitive = options.find(
    (option) => normalizeOption(option) === normalizeOption(label),
  );
  if (caseInsensitive) return caseInsensitive;

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

export function displayValueForChoicePlacement(
  field: { type: string; label: string; options?: string[] },
  placementLabel: string,
  value: unknown,
  showMarkerWhenEmpty = false,
): string | null {
  if (!isChoiceFieldType(field.type)) return null;

  if (isOthersBlankPlacementLabel(placementLabel)) {
    const hasOthers = (field.options ?? []).some((option) => isOthersOptionLabel(option));
    if (!hasOthers) return "";
    const detail = extractOthersDetail(value);
    if (detail) return detail;
    return showMarkerWhenEmpty ? "…" : "";
  }

  const option = resolvePlacementOption(field, placementLabel);
  if (!option) return null;

  if (isChoiceOptionSelected(value, option)) return PLACEMENT_CHECKMARK;
  if (showMarkerWhenEmpty) return PLACEMENT_CHECKMARK;
  return "";
}

export function isPlacementCheckmark(text: string): boolean {
  return text === PLACEMENT_CHECKMARK;
}
