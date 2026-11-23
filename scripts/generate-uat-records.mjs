/** STS UAT – Record Admin. Layout follows the NMP UAT template. Aligned to current Admin portal UI. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, PageOrientation,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
  Packer,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "docs/STS_UAT_Records.docx");
const FONT = "Calibri";
const SZ = 20; // 10pt
const W = 16838, H = 11906, M = 1000;
const TW = W - M * 2;
const ln = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const box = { top: ln, bottom: ln, left: ln, right: ln };

const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: SZ, ...o });
const para = (t, o = {}, p = {}) => new Paragraph({ spacing: { after: 40 }, ...p, children: [run(t, o)] });
const cell = (children, w, o = {}) => new TableCell({
  borders: box, width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
  margins: { top: 60, bottom: 60, left: 100, right: 100 }, ...o,
  children: Array.isArray(children) ? children : [children],
});

import { modules, role, sections } from "./uat-records-content.mjs";

const C = [820, 2150, 3500, 4300, 700, 700, TW - 820 - 2150 - 3500 - 4300 - 1400];
const hdr = () => new TableRow({ tableHeader: true, children: ["Test No.", "Description of Task", "Steps to Execute", "Expected Result", "Pass", "Fail", "Comments / Suggestions"]
  .map((t, i) => cell(para(t, { bold: true }, { alignment: AlignmentType.CENTER }), C[i], { verticalAlign: VerticalAlign.CENTER })) });

const rows = [hdr()];
sections.forEach(([title, tests], si) => {
  rows.push(new TableRow({ cantSplit: true, children: [cell(para(`Application ${si + 1}: ${title}`), TW, {
    columnSpan: 7, shading: { type: ShadingType.CLEAR, fill: "B4C6E7", color: "auto" } })] }));
  tests.forEach(([desc, steps, exp, fmt], ti) => {
    rows.push(new TableRow({ cantSplit: true, children: [
      cell(para(`${si + 1}.${ti + 1}.`), C[0]),
      cell([para(desc), ...(fmt ? fmt.map((f) => para(f, { bold: /:$/.test(f), italics: !/:$/.test(f) })) : [])], C[1]),
      cell(steps.map((s) => para(`-  ${s}`)), C[2]),
      cell(para(exp), C[3]),
      cell(para(""), C[4]), cell(para(""), C[5]), cell(para(""), C[6]),
    ] }));
  });
});

const info = (l, v, l2, v2) => new TableRow({ children: [
  cell(para(l, { bold: true }), 2200, { shading: undefined }), cell(para(v), 3600), cell(para(l2, { bold: true }), 2600), cell(para(v2), TW - 8400)] });
const infoTable = new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: [2200, 3600, 2600, TW - 8400], rows: [
  info("Information System", "Support Ticketing System (STS) – National Museum of the Philippines", "UAT Number", ""),
  info("Module", modules, "", ""),
  info("Testing Start Date", "", "Testing End Date", ""),
  info("Name of Tester", "", "", ""),
  info("Role Tested", role, "", ""),
] });

const logo = fs.readFileSync(path.join(root, "public/nmp-logo.png"));
const FOOT = "Support Ticketing System – User Acceptance Testing (Record Admin)";
const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: SZ } } } },
  sections: [{
    properties: { page: { size: { width: H, height: W, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1300, bottom: 900, left: M, right: M, header: 300, footer: 400 } } },
    headers: { default: new Header({ children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: logo, transformation: { width: 48, height: 48 }, altText: { title: "NMP", description: "National Museum of the Philippines logo", name: "nmp-logo" } })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [run("PAMBANSANG MUSEO NG PILIPINAS", { bold: true, size: 16, color: "5B1A18" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000", space: 6 } }, children: [run("NATIONAL MUSEUM OF THE PHILIPPINES", { bold: true, size: 16, color: "5B1A18" })] }),
    ] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      run(`${FOOT}  |  Page `, { size: 14, color: "595959" }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: "595959" }),
      run(" of ", { size: 14, color: "595959" }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: "595959" }),
    ] })] }) },
    children: [infoTable, new Paragraph({ spacing: { after: 200 }, children: [] }),
      new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: C, rows })],
  }],
});
fs.writeFileSync(out, await Packer.toBuffer(doc));
console.log("wrote", out);
