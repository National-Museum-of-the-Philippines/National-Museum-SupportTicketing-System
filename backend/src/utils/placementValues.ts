import { displayValueForChoicePlacement } from "./placementChoiceValues.js";
import { PROFILE_PLACEMENT_VARIABLES } from "./profilePlacementFields.js";

type FormField = {
  type: string;
  variable: string;
  label: string;
  options?: string[];
};

export type ParsedPlacement = {
  id?: string;
  variable: string;
  label: string;
  xPct: number;
  yPct: number;
};

type PlacementRef = {
  variable: string;
  label: string;
};

export function placementValueKey(placement: PlacementRef): string {
  return `${placement.variable}\0${placement.label}`;
}

export function isImageAnswerValue(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  return (
    value.startsWith("/uploads/") ||
    value.startsWith("data:image/") ||
    /^https?:\/\/.+\.(png|jpe?g|webp)$/i.test(value)
  );
}

/** Persist every field key so Mongoose does not strip an "empty" answers object. */
export function normalizeTicketAnswers(
  fields: FormFieldRef[],
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const field of fields) {
    const variable = field.variable?.trim() ?? "";
    if (!variable) continue;
    const raw = resolveAnswerForVariable(answers, variable);
    if (raw === undefined || raw === null) {
      normalized[variable] = field.type === "checkbox" ? [] : "";
    } else {
      normalized[variable] = raw;
    }
  }

  for (const variable of PROFILE_PLACEMENT_VARIABLES) {
    const raw = resolveAnswerForVariable(answers, variable);
    if (raw !== undefined && raw !== null && raw !== "") {
      normalized[variable] = raw;
    }
  }

  return normalized;
}

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

export function formatSubmissionValue(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";

  switch (field.type) {
    case "checkbox": {
      if (Array.isArray(value)) return value.filter(Boolean).join(", ");
      if (value === true || value === "true") return "Yes";
      if (value === false || value === "false") return "";
      return String(value);
    }
    case "signature":
      return isImageAnswerValue(value) ? "" : String(value);
    case "file":
      return typeof value === "string" && value.trim() ? "File attached" : "";
    default:
      return String(value);
  }
}

function resolveFieldForPlacement(fields: FormField[], placementVariable: string) {
  const inner = placementVariable.replace(/^\{\{|\}\}$/g, "");
  return (
    fields.find(
      (field) =>
        field.variable === placementVariable ||
        field.variable === inner ||
        field.variable.replace(/^\{\{|\}\}$/g, "") === inner,
    ) ?? null
  );
}

type FormFieldRef = { variable?: string | null; type?: string | null };

function formatPlacementValue(
  field: FormField | null,
  placement: PlacementRef,
  value: unknown,
  showMarkerWhenEmpty = false,
): string {
  if (field) {
    const choiceDisplay = displayValueForChoicePlacement(
      field,
      placement.label,
      value,
      showMarkerWhenEmpty,
    );
    if (choiceDisplay !== null) return choiceDisplay;
  }

  return field
    ? formatSubmissionValue(field, value)
    : value !== undefined && value !== null && value !== ""
      ? String(value)
      : "";
}

export function buildSubmissionValues(
  fields: FormField[],
  answers: Record<string, unknown>,
  placements: PlacementRef[],
) {
  const map: Record<string, string> = {};

  for (const placement of placements) {
    const field = resolveFieldForPlacement(fields, placement.variable);
    const raw = resolveAnswerForVariable(answers, placement.variable);
    map[placementValueKey(placement)] = formatPlacementValue(field, placement, raw);
  }

  return map;
}

export function buildSubmissionImageValues(
  fields: FormField[],
  answers: Record<string, unknown>,
  placements: PlacementRef[],
) {
  const map: Record<string, string> = {};

  for (const placement of placements) {
    const field = resolveFieldForPlacement(fields, placement.variable);
    if (field?.type !== "signature") continue;
    const raw = resolveAnswerForVariable(answers, placement.variable);
    if (isImageAnswerValue(raw)) {
      map[placement.variable] = raw;
    }
  }

  return map;
}

const PLACEMENT_BLOCK =
  /\[NMP placements\]\s*fontSize\t(\d+(?:\.\d+)?)\s*([\s\S]*?)\[\/NMP placements\]/i;

/** Parse saved placement rows from the printTemplate block (fallback if array is empty). */
export function parsePlacementsFromTemplate(printTemplate: string | undefined | null) {
  if (!printTemplate?.trim()) return { fontSize: undefined, placements: [] as ParsedPlacement[] };

  const match = printTemplate.match(PLACEMENT_BLOCK);
  if (!match) return { fontSize: undefined, placements: [] as ParsedPlacement[] };

  const fontSize = Number(match[1]);
  const rows = match[2]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const placements = rows.map((line, index) => {
    const [variable, xPct, yPct, label] = line.split("\t");
    return {
      id: `parsed_${index}`,
      variable: variable ?? "",
      label: label ?? variable ?? "",
      xPct: Number(xPct),
      yPct: Number(yPct),
    };
  });

  return {
    fontSize: Number.isFinite(fontSize) ? fontSize : undefined,
    placements: placements.filter((p) => p.variable && Number.isFinite(p.xPct) && Number.isFinite(p.yPct)),
  };
}
