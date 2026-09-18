/** Optional preset choices for checkbox/dropdown fields on general request forms. */
export const COMMON_SERVICE_TYPE_OPTIONS = [
  "Information System",
  "Website Update",
  "Event Assistance",
  "Network/Hardware Troubleshooting",
  "Software Troubleshooting",
  "Others",
] as const;

/** @deprecated Use COMMON_SERVICE_TYPE_OPTIONS */
export const TA_SERVICE_TYPE_OPTIONS = COMMON_SERVICE_TYPE_OPTIONS;

export function parseCommaSeparatedOptions(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Fix options saved as one comma-separated string instead of an array. */
export function normalizeChoiceFieldOptions(options: string[] | undefined): string[] {
  const raw = options ?? [];
  if (raw.length === 1 && raw[0].includes(",")) {
    return parseCommaSeparatedOptions(raw[0]);
  }
  return [...raw];
}

export function commonServiceTypesPlaceholder(): string {
  return COMMON_SERVICE_TYPE_OPTIONS.join(", ");
}

/** @deprecated Use commonServiceTypesPlaceholder */
export function taServiceTypesPlaceholder(): string {
  return commonServiceTypesPlaceholder();
}
