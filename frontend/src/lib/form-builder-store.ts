import { format } from "date-fns";

// Form draft types and helpers for the form builder wizard.

export type FieldType =
  | "textbox"
  | "textarea"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "date"
  | "time"
  | "datetime"
  | "file"
  | "email"
  | "number"
  | "signature";

export interface FormField {
  id: string;
  type: FieldType;
  variable: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
  numberMode?: "integer" | "decimal";
}

export interface Signatory {
  id: string;
  division: string;
  name: string;
}

export interface ActionOfficerDraft {
  userId: string;
  name: string;
  email?: string;
  division?: string;
}

export interface PrintFieldPlacement {
  id: string;
  variable: string;
  label: string;
  /** 0–100, relative to template box */
  xPct: number;
  yPct: number;
}

export interface FormDraft {
  id: string;
  title: string;
  refNumber: string;
  effectivity: string;
  version: string;
  /** Section used to group published forms on client Submit Request. */
  department?: string;
  /** Client Request Approval — Recommending Officer required before Process Owner. */
  requireRecommendingOfficer?: boolean;
  /** Client Request Approval — Immediate Supervisor after Recommending Officer. */
  requireImmediateSupervisor?: boolean;
  /** Process Owner Approval — selected Action Officers (order matters; last assigns). */
  actionOfficers?: ActionOfficerDraft[];
  /** Derived from actionOfficers length (kept for API / runtime). */
  actionOfficerCount?: number;
  fields: FormField[];
  signatories: Signatory[];
  printTemplate: string;
  /** PNG/JPEG/WebP data URL of the scanned or exported form (optional; can be large). */
  printTemplateImage?: string | null;
  /** Server path to the uploaded template file (PDF or image). */
  printTemplateImagePath?: string | null;
  /** Field variables positioned on the uploaded image. */
  printPlacements?: PrintFieldPlacement[];
  /** Font size (px) for answers placed on the print template preview. */
  printPlacementFontSize?: number;
  workProcedureName?: string;
  workProcedurePath?: string;
  status: "draft" | "published";
  createdAt: number;
}

const VAR_PREFIX: Record<FieldType, string> = {
  textbox: "txt",
  textarea: "txa",
  dropdown: "drp",
  checkbox: "chk",
  radio: "rad",
  date: "dt",
  time: "tm",
  datetime: "dttm",
  file: "file",
  email: "eml",
  number: "num",
  signature: "sig",
};

export const DEFAULT_PRINT_PLACEMENT_FONT_SIZE = 10;
export const MIN_PRINT_PLACEMENT_FONT_SIZE = 8;
export const MAX_PRINT_PLACEMENT_FONT_SIZE = 24;

const generateRef = () => {
  const yr = new Date().getFullYear();
  const suffix =
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `FRM-${yr}-${suffix}`;
};

export function newDraft(): FormDraft {
  return {
    id: `f${Date.now()}`,
    title: "",
    refNumber: generateRef(),
    effectivity: format(new Date(), "yyyy-MM-dd"),
    version: "v1.0",
    department: "",
    requireRecommendingOfficer: false,
    requireImmediateSupervisor: false,
    actionOfficers: [{ userId: "", name: "", email: "", division: "" }],
    actionOfficerCount: 1,
    fields: [],
    signatories: [],
    printTemplate: "",
    printPlacements: [],
    printTemplateImage: null,
    printPlacementFontSize: DEFAULT_PRINT_PLACEMENT_FONT_SIZE,
    status: "draft",
    createdAt: Date.now(),
  };
}

export function nextVariable(type: FieldType, fields: FormField[]) {
  const prefix = VAR_PREFIX[type];
  const used = fields.filter((f) => f.variable.startsWith(`{{${prefix}`)).length + 1;
  return `{{${prefix}${String(used).padStart(2, "0")}}}`;
}

const FORM_BUILDER_WIP_KEY = "nmp-form-builder-wip";

export type FormBuilderWip = { draft: FormDraft; step: string };

export function loadFormBuilderWip(): FormBuilderWip | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FORM_BUILDER_WIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormBuilderWip;
    if (!parsed?.draft?.id || !parsed.step) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFormBuilderWip(draft: FormDraft, step: string) {
  if (typeof sessionStorage === "undefined") return;
  const payload = { draft, step };
  try {
    sessionStorage.setItem(FORM_BUILDER_WIP_KEY, JSON.stringify(payload));
  } catch {
    try {
      const { printTemplateImage: _image, ...rest } = draft;
      sessionStorage.setItem(
        FORM_BUILDER_WIP_KEY,
        JSON.stringify({ draft: { ...rest, printTemplateImage: null }, step }),
      );
    } catch {
      // Quota exceeded — keep in-memory draft only.
    }
  }
}

export function clearFormBuilderWip() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(FORM_BUILDER_WIP_KEY);
}
