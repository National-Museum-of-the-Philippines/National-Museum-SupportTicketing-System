/**
 * Build STS Employee User Manual .docx from the polished Markdown.
 * Uses frontend/node_modules/docx (already in the project).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mdPath = path.join(root, "docs/Support_Ticketing_System_Employee_User_Manual_V1.md");
const outPath = path.join(root, "docs/Support_Ticketing_System_Employee_User_Manual_V1.docx");

const md = fs.readFileSync(mdPath, "utf8");
const lines = md.split(/\r?\n/);

function isFigurePlaceholder(line) {
  return line.trim() === "*[Screenshot placeholder]*";
}

function isFigureCaption(line) {
  return /^Figure\s+\d+/.test(line.trim());
}

function headingLevel(line) {
  const t = line.trim();
  if (/^\d+\.\d+\.\d+\.\d+\s/.test(t)) return HeadingLevel.HEADING_4;
  if (/^\d+\.\d+\.\d+\s/.test(t)) return HeadingLevel.HEADING_4;
  if (/^\d+\.\d+\s/.test(t)) return HeadingLevel.HEADING_3;
  if (/^\d+\.\s/.test(t)) return HeadingLevel.HEADING_2;
  if (/^(Table of Contents|List of Figures)$/.test(t)) return HeadingLevel.HEADING_2;
  return null;
}

const children = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].replace(/\s+$/, "");
  const trimmed = line.trim();

  if (!trimmed) {
    children.push(new Paragraph({ text: "" }));
    continue;
  }

  if (isFigurePlaceholder(trimmed)) continue;

  if (isFigureCaption(trimmed)) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 200 },
        children: [
          new TextRun({
            text: trimmed,
            italics: true,
            size: 20,
            color: "444444",
          }),
        ],
      }),
    );
    continue;
  }

  if (i < 6) {
    const isOrg = i === 0;
    const isProduct = i === 1;
    const isManual = i === 2;
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: isManual ? 80 : 40 },
        children: [
          new TextRun({
            text: trimmed,
            bold: isOrg || isProduct || isManual,
            size: isOrg ? 28 : isProduct ? 36 : isManual ? 32 : 22,
            color: isProduct ? "6B0F1A" : "111111",
          }),
        ],
      }),
    );
    continue;
  }

  const hl = headingLevel(trimmed);
  if (hl) {
    children.push(
      new Paragraph({
        heading: hl,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: trimmed, bold: true })],
      }),
    );
    continue;
  }

  if (trimmed.startsWith("● ") || trimmed.startsWith("- ")) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: convertInchesToTwip(0.25) },
        children: [new TextRun({ text: `• ${trimmed.slice(2)}`, size: 22 })],
      }),
    );
    continue;
  }

  if (/^(Note:|Important:)/.test(trimmed)) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 24, color: "6B0F1A", space: 8 },
        },
        indent: { left: convertInchesToTwip(0.1) },
        children: [new TextRun({ text: trimmed, italics: true, size: 20, color: "333333" })],
      }),
    );
    continue;
  }

  if (trimmed.startsWith("— End")) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: trimmed, italics: true, size: 20, color: "666666" })],
      }),
    );
    continue;
  }

  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: trimmed, size: 22 })],
    }),
  );
}

const doc = new Document({
  creator: "National Museum of the Philippines",
  title: "Support Ticketing System — Employee User Manual V2.2",
  description: "Employee user manual for the NMP Support Ticketing System",
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
          },
        },
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
