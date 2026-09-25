import type { FormField, PrintFieldPlacement } from "@/lib/form-builder-store";
import { PRINT_OVERLAY_FONT_SIZE_PX } from "@/lib/print-overlay-font";
import type { FormRecord } from "@/lib/api/types";
import { answerValueIsFilled, formatFieldAnswerValue } from "@/lib/form-field-values";
import { displayValueForChoicePlacement } from "@/lib/placement-choice-values";

const PLACEMENT_BLOCK =
  /\[NMP placements\]\s*fontSize\t(\d+(?:\.\d+)?)\s*([\s\S]*?)\[\/NMP placements\]/i;

/** Parse saved placement rows from the printTemplate block (fallback if array is empty). */
export function parsePlacementsFromTemplate(printTemplate: string | undefined | null): {
  fontSize?: number;
  placements: PrintFieldPlacement[];
} {
  if (!printTemplate?.trim()) return { placements: [] };

  const match = printTemplate.match(PLACEMENT_BLOCK);
  if (!match) return { placements: [] };

  const fontSize = Number(match[1]);
  const rows = match[2]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const placements = rows
    .map((line, index) => {
      const [variable, xPct, yPct, label] = line.split("\t");
      const x = Number(xPct);
      const y = Number(yPct);
      if (!variable || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        id: `parsed_${index}`,
        variable,
        label: label ?? variable,
        xPct: x,
        yPct: y,
      } satisfies PrintFieldPlacement;
    })
    .filter(Boolean) as PrintFieldPlacement[];

  return {
    fontSize: Number.isFinite(fontSize) ? fontSize : undefined,
    placements,
  };
}

export function resolveFormPlacements(form: FormRecord): PrintFieldPlacement[] {
  const raw = form.printPlacements?.length
    ? form.printPlacements
    : parsePlacementsFromTemplate(form.printTemplate).placements;
  return raw
    .map((placement, index) => {
      const variable = String(placement.variable ?? "").trim();
      const x = Number(
        (placement as PrintFieldPlacement).xPct ??
          (placement as { x_pct?: number }).x_pct,
      );
      const y = Number(
        (placement as PrintFieldPlacement).yPct ??
          (placement as { y_pct?: number }).y_pct,
      );
      if (!variable || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        id: placement.id || `placement_${index}`,
        variable,
        label: (placement.label ?? variable).trim() || variable,
        xPct: x,
        yPct: y,
      } satisfies PrintFieldPlacement;
    })
    .filter((row): row is PrintFieldPlacement => row !== null);
}

export function resolveFormPlacementFontSize(_form: FormRecord): number {
  return PRINT_OVERLAY_FONT_SIZE_PX;
}

/** True when the ticket/form has at least one non-empty submitted answer. */
export function hasFilledAnswers(answers: Record<string, unknown> | undefined | null): boolean {
  if (!answers) return false;
  return Object.entries(answers).some(
    ([key, value]) => !key.startsWith("__") && answerValueIsFilled(value),
  );
}

/** Resolve an answer whether the key is `{{txt01}}`, `txt01`, etc. */
export function resolveAnswerForVariable(
  answers: Record<string, unknown>,
  variable: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(answers, variable)) {
    return answers[variable];
  }

  const inner = variable.replace(/^\{\{|\}\}$/g, "");
  if (inner !== variable && Object.prototype.hasOwnProperty.call(answers, inner)) {
    return answers[inner];
  }

  const wrapped = variable.startsWith("{{") ? variable : `{{${inner}}}`;
  if (wrapped !== variable && Object.prototype.hasOwnProperty.call(answers, wrapped)) {
    return answers[wrapped];
  }

  return undefined;
}

function formatAnswerValue(field: FormField, value: unknown): string {
  return formatFieldAnswerValue(field, value);
}

/** Actual submitted answers mapped for print layout overlays. */
export function buildSubmissionDisplayValues(
  fields: FormField[],
  answers: Record<string, unknown>,
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const field of fields) {
    map[field.variable] = formatAnswerValue(
      field,
      resolveAnswerForVariable(answers, field.variable),
    );
  }

  return map;
}

export function displayValueForPlacement(
  fields: FormField[],
  placementVariable: string,
  placementLabel: string,
  answers: Record<string, unknown>,
  showLabelWhenEmpty = false,
  emptyChoiceAsCheckmark = showLabelWhenEmpty,
): string {
  const field =
    fields.find(
      (f) =>
        f.variable === placementVariable ||
        f.variable === placementVariable.replace(/^\{\{|\}\}$/g, "") ||
        f.variable.replace(/^\{\{|\}\}$/g, "") === placementVariable.replace(/^\{\{|\}\}$/g, ""),
    ) ?? null;

  const raw = resolveAnswerForVariable(answers, placementVariable);

  if (field) {
    const choiceDisplay = displayValueForChoicePlacement(
      field,
      placementLabel,
      raw,
      emptyChoiceAsCheckmark,
    );
    // "" = unselected option box (do not fall through to the field label).
    if (choiceDisplay !== null) return choiceDisplay;
  }

  const answered = field
    ? formatAnswerValue(field, raw)
    : raw !== undefined && raw !== null && raw !== ""
      ? String(raw)
      : "";

  if (answered.trim()) return answered.trim();
  if (showLabelWhenEmpty) return (field?.label ?? placementLabel).trim();
  return "";
}
