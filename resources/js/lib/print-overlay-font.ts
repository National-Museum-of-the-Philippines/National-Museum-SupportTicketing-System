import { DEFAULT_PRINT_PLACEMENT_FONT_SIZE } from "@/lib/form-builder-store";

/** Fixed overlay text size for every form viewer (builder, admin, client, records, tickets). */
export const PRINT_OVERLAY_FONT_SIZE_PX = DEFAULT_PRINT_PLACEMENT_FONT_SIZE;

/** Scale with document zoom controls only — never use saved per-form font sizes. */
export function printOverlayFontSizePx(zoom = 1): number {
  return PRINT_OVERLAY_FONT_SIZE_PX * zoom;
}
