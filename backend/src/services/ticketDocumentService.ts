import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { config } from "../config.js";
import { Form } from "../models/Form.js";
import { AppError } from "../utils/errors.js";
import { embedTemplateWithPlacements, type Placement } from "./templateEmbedService.js";
import { getTicketById } from "./ticketService.js";
import { buildSubmissionValues, buildSubmissionImageValues, parsePlacementsFromTemplate, resolveAnswerForVariable, formatSubmissionValue, isImageAnswerValue } from "../utils/placementValues.js";
import { mergeRequesterProfileIntoAnswers } from "../utils/profilePlacementFields.js";

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

function isPdfFile(urlPath: string, mimeType?: string) {
  return mimeType === "application/pdf" || /\.pdf$/i.test(urlPath);
}

function formatSubmissionValueForSummary(field: FormField, value: unknown): string {
  if (field.type === "signature" && isImageAnswerValue(value)) return "Signed";
  const formatted = formatSubmissionValue(field, value);
  return formatted || "—";
}

async function appendTextSummaryPage(
  pdfDoc: PDFDocument,
  ticket: {
    ticketNumber: string;
    formTitle: string;
    creatorName: string;
    division?: string;
    createdAt?: Date | string;
  },
  fields: FormField[],
  answers: Record<string, unknown>,
) {
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const draw = (text: string, size = 11, useBold = false) => {
    page.drawText(text, { x: 48, y, size, font: useBold ? bold : font, color: rgb(0.12, 0.12, 0.12) });
    y -= size + 8;
  };

  draw("Technical Assistance Request", 16, true);
  draw(`Ticket: ${ticket.ticketNumber}`, 12, true);
  draw(`Form: ${ticket.formTitle}`);
  draw(`Submitted by: ${ticket.creatorName}`);
  draw(`Division: ${ticket.division || "—"}`);
  draw(`Created: ${new Date(ticket.createdAt ?? Date.now()).toLocaleString()}`);
  y -= 8;
  draw("Submission details", 13, true);

  for (const field of fields) {
    const value =
      formatSubmissionValueForSummary(field, resolveAnswerForVariable(answers, field.variable));
    draw(`${field.label}: ${value}`);
    if (y < 72) break;
  }
}

async function appendPdfAttachment(pdfDoc: PDFDocument, attachmentPath: string) {
  const bytes = fs.readFileSync(attachmentPath);
  const attachment = await PDFDocument.load(bytes);
  const pages = await pdfDoc.copyPages(attachment, attachment.getPageIndices());
  for (const page of pages) pdfDoc.addPage(page);
}

export async function generateTicketDocumentPdf(ticketId: string) {
  const ticket = await getTicketById(ticketId);
  const populatedForm =
    typeof ticket.formId === "object" && ticket.formId !== null && "fields" in ticket.formId
      ? ticket.formId
      : await Form.findById(String(ticket.formId));
  if (!populatedForm || Array.isArray(populatedForm)) {
    throw new AppError(404, "Form not found for this ticket");
  }
  const formDoc = populatedForm as {
    fields?: FormField[];
    printTemplateImagePath?: string | null;
    printPlacements?: Placement[];
    printPlacementFontSize?: number;
    workProcedurePath?: string | null;
    workProcedureName?: string | null;
  };

  const fields = formDoc.fields ?? [];
  const answers = mergeRequesterProfileIntoAnswers(
    {
      name: ticket.creatorName,
      email: (ticket as { creatorEmail?: string }).creatorEmail,
      division: ticket.division,
    },
    (ticket.answers ?? {}) as Record<string, unknown>,
  );
  const placements = (formDoc.printPlacements?.length
    ? formDoc.printPlacements
    : parsePlacementsFromTemplate(
        typeof populatedForm === "object" && populatedForm !== null && "printTemplate" in populatedForm
          ? String((populatedForm as { printTemplate?: string }).printTemplate ?? "")
          : "",
      ).placements) as Placement[];
  const values = buildSubmissionValues(fields, answers, placements);
  const imageValues = buildSubmissionImageValues(fields, answers, placements);
  const pdfDoc = await PDFDocument.create();

  const templateUrl = formDoc.printTemplateImagePath;
  if (templateUrl) {
    const templatePath = resolveUploadPath(templateUrl);
    const embedded = await embedTemplateWithPlacements(
      pdfDoc,
      templatePath,
      placements,
      values,
      formDoc.printPlacementFontSize ?? 10,
      { emptyFallbackToLabel: false, imageValues },
    );
    if (!embedded && pdfDoc.getPageCount() === 0) {
      await appendTextSummaryPage(pdfDoc, ticket, fields, answers);
    }
  }

  if (pdfDoc.getPageCount() === 0) {
    await appendTextSummaryPage(pdfDoc, ticket, fields, answers);
  }

  if (formDoc.workProcedurePath && isPdfFile(formDoc.workProcedurePath)) {
    const procedurePath = resolveUploadPath(formDoc.workProcedurePath);
    if (fs.existsSync(procedurePath)) {
      await appendPdfAttachment(pdfDoc, procedurePath);
    }
  }

  if (ticket.attachmentUrl && isPdfFile(ticket.attachmentUrl, ticket.attachmentMimeType)) {
    const attachmentPath = resolveUploadPath(ticket.attachmentUrl);
    if (fs.existsSync(attachmentPath)) {
      await appendPdfAttachment(pdfDoc, attachmentPath);
    }
  }

  if (pdfDoc.getPageCount() === 0) {
    throw new AppError(404, "No PDF document is available for this request");
  }

  return pdfDoc.save();
}
