import { isPlacementCheckmark } from "../utils/placementChoiceValues.js";
import { placementValueKey } from "../utils/placementValues.js";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { config } from "../config.js";

export type Placement = {
  variable: string;
  label: string;
  xPct: number;
  yPct: number;
};

/**
 * Matches form-builder CSS:
 *   .dynamic-text-anchor { transform: translateY(calc(var(--dynamic-text-size) * -1)); }
 * Baseline sits ~ascender below the top of that translated box.
 */
const FONT_ASCENDER_RATIO = 0.72;

const PREFERRED_FONTS = [
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];

function resolveLocalUploadPath(urlPath: string) {
  const filename = path.basename(urlPath);
  return path.join(config.uploadDir, filename);
}

function placementBaselineFromTop(pageHeight: number, yPct: number, fontSize: number) {
  const anchorTop = (yPct / 100) * pageHeight;
  return anchorTop - fontSize * (1 - FONT_ASCENDER_RATIO);
}

/**
 * Form builder maps on a rasterized PDF at scale = min(2, 1600/pageWidth).
 * Font size is chosen in CSS px on that raster — convert back to PDF points
 * when burning text into downloadable/ticket PDFs.
 */
function fontSizeForPdfPage(pageWidth: number, cssFontSize: number) {
  const previewScale = Math.min(2, 1600 / Math.max(pageWidth, 1));
  const size = cssFontSize / previewScale;
  return Math.max(4, Math.min(72, size));
}

async function embedPlacementFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  for (const fontPath of PREFERRED_FONTS) {
    if (!fs.existsSync(fontPath)) continue;
    try {
      const bytes = fs.readFileSync(fontPath);
      return await pdfDoc.embedFont(bytes, { subset: true });
    } catch {
      /* try next */
    }
  }
  return pdfDoc.embedFont(StandardFonts.Helvetica);
}

/** Strip characters the embedded font cannot encode (avoid odd gaps / tofu). */
function sanitizeDrawText(font: PDFFont, text: string) {
  let out = "";
  for (const char of text) {
    try {
      font.encodeText(char);
      out += char;
    } catch {
      out += char === "\t" ? " " : char === "\n" || char === "\r" ? " " : "?";
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Vector checkmark for checkbox placements. */
function drawPlacementCheckmark(
  page: PDFPage,
  anchorX: number,
  baselineFromTop: number,
  pageHeight: number,
  fontSize: number,
) {
  const size = fontSize * 0.95;
  const thickness = Math.max(0.8, fontSize * 0.11);
  const color = rgb(0.1, 0.1, 0.1);
  const baselineY = pageHeight - baselineFromTop;

  const start = { x: anchorX, y: baselineY - size * 0.12 };
  const mid = { x: anchorX + size * 0.38, y: baselineY - size * 0.52 };
  const end = { x: anchorX + size * 0.95, y: baselineY + size * 0.18 };

  page.drawLine({ start, end: mid, thickness, color });
  page.drawLine({ start: mid, end, thickness, color });
}

async function drawPlacementImage(
  page: PDFPage,
  pdfDoc: PDFDocument,
  imagePath: string,
  placement: Placement,
  fontSize: number,
) {
  if (!fs.existsSync(imagePath)) return false;

  const bytes = fs.readFileSync(imagePath);
  const lower = imagePath.toLowerCase();
  let image;
  if (lower.endsWith(".png")) {
    image = await pdfDoc.embedPng(bytes);
  } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    image = await pdfDoc.embedJpg(bytes);
  } else {
    return false;
  }

  const { width, height } = page.getSize();
  const imgWidth = fontSize * 8;
  const imgHeight = fontSize * 3;
  const x = (placement.xPct / 100) * width;
  const top = (placement.yPct / 100) * height;
  const y = height - top - imgHeight;

  page.drawImage(image, { x, y, width: imgWidth, height: imgHeight });
  return true;
}

async function drawPlacementsOnPage(
  page: PDFPage,
  pdfDoc: PDFDocument,
  placements: Placement[],
  values: Record<string, string>,
  imageValues: Record<string, string>,
  fontSize: number,
  font: PDFFont,
  emptyFallbackToLabel: boolean,
) {
  const { width, height } = page.getSize();
  const maxWidth = fontSize * 15;

  for (const placement of placements) {
    const imageUrl = imageValues[placement.variable]?.trim();
    if (imageUrl) {
      const imagePath = resolveLocalUploadPath(imageUrl);
      const drawn = await drawPlacementImage(page, pdfDoc, imagePath, placement, fontSize);
      if (drawn) continue;
    }

    const answered = values[placementValueKey(placement)]?.trim() || "";
    const rawText = answered || (emptyFallbackToLabel ? placement.label : "");
    if (!rawText) continue;

    const x = (placement.xPct / 100) * width;
    const baselineFromTop = placementBaselineFromTop(height, placement.yPct, fontSize);
    const y = height - baselineFromTop;
    const isCheck = isPlacementCheckmark(rawText);

    if (isCheck) {
      drawPlacementCheckmark(page, x, baselineFromTop, height, fontSize);
      continue;
    }

    const text = sanitizeDrawText(font, rawText);
    if (!text) continue;

    // Draw as a single line (no wrap) so letter spacing stays even like the mapper preview.
    let drawText = text;
    let drawSize = fontSize;
    const textWidth = font.widthOfTextAtSize(drawText, drawSize);
    if (textWidth > maxWidth && drawText.length > 1) {
      // Slightly shrink rather than wrapping mid-word (which looks uneven).
      drawSize = Math.max(4, (fontSize * maxWidth) / textWidth);
    }

    page.drawText(drawText, {
      x,
      y,
      size: drawSize,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
}

/** Embeds uploaded template (PDF or image) with field values drawn at saved placements. */
export async function embedTemplateWithPlacements(
  pdfDoc: PDFDocument,
  templatePath: string,
  placements: Placement[],
  values: Record<string, string>,
  fontSize: number,
  options?: { emptyFallbackToLabel?: boolean; imageValues?: Record<string, string> },
): Promise<boolean> {
  if (!fs.existsSync(templatePath)) return false;

  const bytes = fs.readFileSync(templatePath);
  const lower = templatePath.toLowerCase();
  const emptyFallbackToLabel = options?.emptyFallbackToLabel ?? false;
  const imageValues = options?.imageValues ?? {};
  const font = await embedPlacementFont(pdfDoc);

  if (lower.endsWith(".pdf")) {
    const templatePdf = await PDFDocument.load(bytes);
    const pages = await pdfDoc.copyPages(templatePdf, templatePdf.getPageIndices());

    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i];
      pdfDoc.addPage(page);
      if (i === 0 && placements.length > 0) {
        const { width } = page.getSize();
        const drawSize = fontSizeForPdfPage(width, fontSize);
        await drawPlacementsOnPage(
          page,
          pdfDoc,
          placements,
          values,
          imageValues,
          drawSize,
          font,
          emptyFallbackToLabel,
        );
      }
    }

    return pages.length > 0;
  }

  let image;
  if (lower.endsWith(".png")) {
    image = await pdfDoc.embedPng(bytes);
  } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    image = await pdfDoc.embedJpg(bytes);
  } else {
    return false;
  }

  // Image templates: page units == pixels, matching CSS px on the mapping canvas.
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

  if (placements.length > 0) {
    await drawPlacementsOnPage(
      page,
      pdfDoc,
      placements,
      values,
      imageValues,
      fontSize,
      font,
      emptyFallbackToLabel,
    );
  }

  return true;
}
