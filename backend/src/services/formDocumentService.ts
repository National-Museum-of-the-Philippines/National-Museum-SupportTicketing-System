import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { config } from "../config.js";
import { Form } from "../models/Form.js";
import { AppError } from "../utils/errors.js";
import { embedTemplateWithPlacements, type Placement } from "./templateEmbedService.js";
import { displayValueForChoicePlacement } from "../utils/placementChoiceValues.js";
import { parsePlacementsFromTemplate, placementValueKey } from "../utils/placementValues.js";

type FormField = {
  type: string;
  variable: string;
  label: string;
  options?: string[];
};

function resolveUploadPath(urlPath: string) {
  const filename = path.basename(urlPath);
  return path.join(config.uploadDir, filename);
}

function buildLayoutPreviewValues(fields: FormField[], placements: Placement[]) {
  const fieldByVar = new Map(fields.map((field) => [field.variable, field]));
  const map: Record<string, string> = {};

  for (const placement of placements) {
    const inner = placement.variable.replace(/^\{\{|\}\}$/g, "");
    const field =
      fieldByVar.get(placement.variable) ??
      fieldByVar.get(inner) ??
      fieldByVar.get(placement.variable.startsWith("{{") ? placement.variable : `{{${inner}}}`) ??
      null;

    const choiceDisplay = field
      ? displayValueForChoicePlacement(field, placement.label, undefined, true)
      : null;
    if (choiceDisplay !== null && choiceDisplay !== "") {
      map[placementValueKey(placement)] = choiceDisplay;
      continue;
    }

    map[placementValueKey(placement)] = (field?.label ?? placement.label ?? "").trim();
  }

  return map;
}

function resolveFormPlacements(form: {
  printPlacements?: Array<{ variable?: string | null; label?: string | null; xPct?: number | null; yPct?: number | null; id?: string | null }>;
  printTemplate?: string | null;
}): Placement[] {
  if (form.printPlacements?.length) {
    return form.printPlacements
      .filter(
        (p): p is { variable: string; label: string; xPct: number; yPct: number; id?: string | null } =>
          Boolean(p.variable) && Number.isFinite(p.xPct) && Number.isFinite(p.yPct),
      )
      .map((p) => ({
        id: p.id ?? undefined,
        variable: p.variable,
        label: p.label ?? p.variable,
        xPct: p.xPct,
        yPct: p.yPct,
      }));
  }
  return parsePlacementsFromTemplate(form.printTemplate ?? undefined).placements as Placement[];
}

async function appendFormSummaryPage(
  pdfDoc: PDFDocument,
  form: {
    title: string;
    refNumber: string;
    version?: string;
    department?: string;
    createdBy?: { name?: string } | null;
  },
  fields: FormField[],
) {
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const draw = (text: string, size = 11, useBold = false) => {
    page.drawText(text, { x: 48, y, size, font: useBold ? bold : font, color: rgb(0.12, 0.12, 0.12) });
    y -= size + 8;
  };

  draw("TA Form — Records Review", 16, true);
  draw(form.title, 13, true);
  draw(`Reference: ${form.refNumber}`);
  draw(`Version: ${form.version || "—"}`);
  draw(`Department: ${form.department || "—"}`);
  draw(`Submitted by: ${form.createdBy?.name || "Admin"}`);
  y -= 8;
  draw("Form fields preview", 13, true);

  for (const field of fields) {
    draw(`${field.label}: —`);
    if (y < 72) break;
  }
}

async function appendPdfFile(pdfDoc: PDFDocument, filePath: string) {
  const bytes = fs.readFileSync(filePath);
  const attachment = await PDFDocument.load(bytes);
  const pages = await pdfDoc.copyPages(attachment, attachment.getPageIndices());
  for (const page of pages) pdfDoc.addPage(page);
}

export async function generateFormPreviewPdf(formId: string) {
  const form = await Form.findById(formId, { populate: "createdBy" });
  if (!form) throw new AppError(404, "Form not found");

  const fields = (form.fields ?? []) as FormField[];
  const placements = resolveFormPlacements(form);
  const values = buildLayoutPreviewValues(fields, placements);
  const pdfDoc = await PDFDocument.create();

  const templateUrl = form.printTemplateImagePath;
  if (templateUrl) {
    const templatePath = resolveUploadPath(templateUrl);
    await embedTemplateWithPlacements(
      pdfDoc,
      templatePath,
      placements,
      values,
      form.printPlacementFontSize ??
        parsePlacementsFromTemplate(form.printTemplate).fontSize ??
        10,
      { emptyFallbackToLabel: true },
    );
  }

  if (pdfDoc.getPageCount() === 0) {
    const createdBy =
      form.createdBy &&
      typeof form.createdBy === "object" &&
      "name" in form.createdBy &&
      typeof (form.createdBy as { name?: string }).name === "string"
        ? { name: (form.createdBy as { name: string }).name }
        : null;
    await appendFormSummaryPage(
      pdfDoc,
      {
        title: form.title,
        refNumber: form.refNumber,
        version: form.version,
        department: form.department,
        createdBy,
      },
      fields,
    );
  }

  if (form.workProcedurePath && /\.pdf$/i.test(form.workProcedurePath)) {
    const procedurePath = resolveUploadPath(form.workProcedurePath);
    if (fs.existsSync(procedurePath)) {
      await appendPdfFile(pdfDoc, procedurePath);
    }
  }

  if (pdfDoc.getPageCount() === 0) {
    throw new AppError(404, "No PDF document is available for this form");
  }

  return pdfDoc.save();
}
