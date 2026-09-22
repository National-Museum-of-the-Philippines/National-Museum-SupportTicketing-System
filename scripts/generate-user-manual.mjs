/**
 * Generate Support Ticketing System Employee User Manual (.docx)
 * from docs/Support_Ticketing_System_Employee_User_Manual_V1.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const inputMd = path.join(root, "docs/Support_Ticketing_System_Employee_User_Manual_V1.md");
const outputDocx = path.join(root, "docs/Support_Ticketing_System_Employee_User_Manual_V2.3.docx");
const publicDocx = path.join(root, "frontend/public/Support_Ticketing_System_Employee_User_Manual_V2.3.docx");

const maroon = "7A1F2E";
const muted = "666666";

function headingLevel(line) {
  const m = line.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
  if (!m) return null;
  const depth = m[1].split(".").length;
  if (depth === 1) return HeadingLevel.HEADING_1;
  if (depth === 2) return HeadingLevel.HEADING_2;
  if (depth === 3) return HeadingLevel.HEADING_3;
  if (depth === 4) return HeadingLevel.HEADING_4;
  return HeadingLevel.HEADING_5;
}

function isTocLine(line) {
  return /^\d+(\.\d+)*\s+/.test(line) && !line.includes("Figure");
}

function paragraphFromLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return new Paragraph({ spacing: { after: 120 } });

  if (trimmed.startsWith("*[Screenshot placeholder]*")) {
    return new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: "[Screenshot placeholder — insert screen capture here]",
          italics: true,
          color: muted,
          size: 20,
        }),
      ],
    });
  }

  if (/^Figure \d+/.test(trimmed)) {
    return new Paragraph({
      spacing: { before: 80, after: 200 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: trimmed, italics: true, size: 20, color: muted })],
    });
  }

  if (trimmed.startsWith("— End of")) {
    return new Paragraph({
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: trimmed, bold: true, size: 22 })],
    });
  }

  const level = headingLevel(trimmed);
  if (level) {
    const text = trimmed.replace(/^\d+(?:\.\d+)*\s+/, "");
    return new Paragraph({
      heading: level,
      spacing: { before: level === HeadingLevel.HEADING_1 ? 280 : 180, after: 120 },
      children: [new TextRun({ text: trimmed, bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 24 })],
    });
  }

  if (trimmed.startsWith("●")) {
    return new Paragraph({
      spacing: { after: 80 },
      indent: { left: 720 },
      children: [new TextRun({ text: trimmed.replace(/^●\s*/, "• "), size: 22 })],
    });
  }

  if (trimmed.startsWith("Note:") || trimmed.startsWith("Important:")) {
    return new Paragraph({
      spacing: { after: 100 },
      indent: { left: 360 },
      children: [
        new TextRun({ text: trimmed.split(":")[0] + ":", bold: true, size: 22 }),
        new TextRun({ text: trimmed.slice(trimmed.indexOf(":") + 1), size: 22 }),
      ],
    });
  }

  if (trimmed === "Table of Contents") {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 160 },
      children: [new TextRun({ text: trimmed, bold: true, size: 28 })],
    });
  }

  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: trimmed, size: 22 })],
  });
}

function buildCover(lines) {
  const coverLines = [];
  for (const line of lines) {
    if (line.trim() === "Table of Contents") break;
    if (line.trim()) coverLines.push(line.trim());
  }
  return coverLines.map((text, i) => {
    const isTitle = i === 1;
    const isVersion = text.startsWith("Version");
    const isDate = /^\d/.test(text);
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: isTitle ? 200 : 120 },
      children: [
        new TextRun({
          text,
          bold: isTitle || text === "NATIONAL MUSEUM OF THE PHILIPPINES",
          size: isTitle ? 36 : isVersion ? 24 : 22,
          color: isTitle ? maroon : undefined,
        }),
      ],
    });
  });
}

function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const children = [];
  let inCover = true;
  let inToc = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inCover) {
      if (trimmed === "Table of Contents") {
        inCover = false;
        inToc = true;
        children.push(...buildCover(lines));
        children.push(paragraphFromLine(trimmed));
        continue;
      }
      continue;
    }

    if (inToc) {
      if (trimmed === "" && children.length > 5) {
        // first blank after TOC entries ends TOC block when we hit section 1
        continue;
      }
      if (/^1\s+Introduction/.test(trimmed)) {
        inToc = false;
        children.push(paragraphFromLine(trimmed));
        continue;
      }
      if (isTocLine(trimmed) || trimmed === "") {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: trimmed, size: 20 })],
          }),
        );
        continue;
      }
    }

    children.push(paragraphFromLine(line));
  }

  return children;
}

async function main() {
  const md = fs.readFileSync(inputMd, "utf8");
  const children = parseMarkdown(md);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Support Ticketing System — Employee User Manual v2.3", size: 18, color: muted }),
                  new TextRun({ text: "   |   Page ", size: 18, color: muted }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: muted }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocx, buffer);
  fs.writeFileSync(publicDocx, buffer);
  console.log(`Wrote ${outputDocx}`);
  console.log(`Wrote ${publicDocx}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
