import type { LiveFormField } from "@/lib/api/types";
import type { FormField } from "@/lib/form-builder-store";
import { resolveMediaUrl } from "@/lib/media-url";
import { formatStoredDateTimeForDisplay, formatStoredTimeForDisplay } from "@/lib/time-ampm";

type AnyField = Pick<FormField | LiveFormField, "type" | "label" | "variable">;

export function isSignatureImageValue(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  return (
    value.startsWith("data:image/") ||
    value.startsWith("/uploads/") ||
    /^https?:\/\/.+\.(png|jpe?g|webp)$/i.test(value)
  );
}

/** Format any field answer for display on PDF overlay or answer lists. */
export function formatFieldAnswerValue(field: AnyField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";

  switch (field.type) {
    case "checkbox": {
      if (Array.isArray(value)) return value.filter(Boolean).join(", ");
      if (value === true || value === "true") return "Yes";
      if (value === false || value === "false") return "";
      return String(value);
    }
    case "signature":
      return isSignatureImageValue(value) ? "Signed" : String(value);
    case "file":
      return typeof value === "string" && value.trim() ? "File attached" : "";
    case "date":
      return String(value);
    case "time":
      return formatStoredTimeForDisplay(value);
    case "datetime":
      return formatStoredDateTimeForDisplay(value);
    default:
      return String(value);
  }
}

export function fieldHasAnswer(field: AnyField, value: unknown): boolean {
  if (value === undefined || value === null) return false;

  switch (field.type) {
    case "checkbox":
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "boolean") return value;
      return String(value).trim() !== "";
    case "signature":
      return isSignatureImageValue(value);
    case "file":
      return typeof value === "string" && value.trim() !== "";
    default:
      return String(value).trim() !== "";
  }
}

export function answerValueIsFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) return true;
    return value.trim() !== "";
  }
  return String(value).trim() !== "";
}

export function resolveSignatureImageSrc(value: unknown): string | null {
  if (!isSignatureImageValue(value)) return null;
  return resolveMediaUrl(value);
}
