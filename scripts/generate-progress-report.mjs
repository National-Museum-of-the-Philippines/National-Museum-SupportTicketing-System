/**
 * NMP ICT progress memo for the Support Ticketing System.
 * Layout follows the office progress-report letter. Content is STS only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(
  __dirname,
  "../docs/NMP_Support_Ticketing_System_Progress_Report_23_September_2026.docx",
);

const FONT = "Times New Roman";
const TEXT = "000000";
const PAGE_W = 11906;
const MARGIN = 864;
const TABLE_W = PAGE_W - MARGIN * 2;

const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const box = { top: line, bottom: line, left: line, right: line };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const open = { top: none, bottom: none, left: none, right: none };

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? 24,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: TEXT,
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before ?? 0, after: opts.after ?? 160, line: 276 },
    alignment: opts.align,
    children,
  });
}

function textPara(text, opts = {}) {
  return para([run(text, opts)], opts);
}

function heading(text) {
  return textPara(text, { bold: true, before: 240, after: 120, size: 24 });
}

function cell(text, width, opts = {}) {
  const header = opts.header ?? false;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: opts.borders ?? box,
    shading: header ? { type: ShadingType.CLEAR, fill: "D9D9D9" } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [run(text, { size: opts.size ?? 20, bold: header || opts.bold })],
      }),
    ],
  });
}

function grid(widths, header, rows) {
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: header.map((label, i) => cell(label, widths[i], { header: true, align: AlignmentType.CENTER })),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            cantSplit: true,
            children: row.map((value, i) =>
              cell(value, widths[i], { align: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT }),
            ),
          }),
      ),
    ],
  });
}

function memoLine(label, lines) {
  const labelW = 1400;
  const valueW = TABLE_W - labelW;
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: [labelW, 280, valueW - 280],
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: labelW, type: WidthType.DXA },
            borders: open,
            margins: { top: 40, bottom: 40, left: 0, right: 80 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [run(label, { bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 280, type: WidthType.DXA },
            borders: open,
            margins: { top: 40, bottom: 40, left: 0, right: 80 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [run(":")],
              }),
            ],
          }),
          new TableCell({
            width: { size: valueW - 280, type: WidthType.DXA },
            borders: open,
            margins: { top: 40, bottom: 40, left: 0, right: 0 },
            children: lines.map(
              (lineText, index) =>
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [run(lineText, { bold: index === 0 })],
                }),
            ),
          }),
        ],
      }),
    ],
  });
}

const milestoneW = [2800, TABLE_W - 2800 - 2200, 2200];
const upcomingW = [700, 2800, 2200, 1800, TABLE_W - 700 - 2800 - 2200 - 1800];

const milestones = [
  ["May 15, 2026", "Start of system development (Technical Assistance Request System)", "Completed"],
  ["June 11, 2026", "Development of the Admin, Records, and Client portals", "Completed"],
  ["June 23, 2026", "Completion of the core request workflow (forms, approval, assignment, and feedback)", "Completed"],
  ["July 2, 2026", "Real-time messaging", "Completed"],
  ["July 28, 2026", "Dashboards and Settings", "Completed"],
  ["August 26, 2026", "Migration to Laravel and MySQL", "Completed"],
  ["September 2026", "Crafting of the Employee User Manual", "Completed"],
  ["September 10, 2026", "Official system deployment", "Completed"],
];

const upcoming = [
  ["1", "Pilot testing", "ICT Section", "Pending", "September 25, 2026"],
  ["2", "Pilot testing", "Records and Admin users", "Pending", "October 3, 2026"],
  ["3", "System launching", "ICT Section", "Pending", "October 2026"],
  ["4", "", "", "", ""],
  ["5", "", "", "", ""],
  ["6", "", "", "", ""],
  ["7", "", "", "", ""],
  ["8", "", "", "", ""],
];

const bullets = [
  "Form building in six steps, including print placement and an optional supporting document",
  "Records review to approve and publish a form, or disapprove it with remarks",
  "Request submission on any published form, with requestor details filled from PAMANA",
  "For Review by Recommending Officer, Immediate Supervisor, and Action Officer when a form requires it",
  "Admin approval, assignment of personnel, and tracking under Assigned to me",
  "Service feedback, closing, and reopening of a request",
  "Messaging, reports, activity logs, and role-based access for Super Admin, Admin, Records, and Staff",
];

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "sts-functions",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 720, hanging: 360 } },
            },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: 864, bottom: 864, left: MARGIN, right: MARGIN },
        },
      },
      children: [
        textPara("OFFICE OF THE DIRECTOR-GENERAL", {
          bold: true,
          align: AlignmentType.CENTER,
          after: 0,
        }),
        textPara("Information and Communication Technology Section", {
          bold: true,
          align: AlignmentType.CENTER,
          after: 280,
        }),

        memoLine("TO", [
          "ATTY. MA. ROSENNE M. FLORES-AVILA",
          "Deputy Director-General for Administration",
        ]),
        memoLine("THRU", ["MELINDA ETRATA", "Administrative Officer V, RMS-GASD"]),
        memoLine("FROM", ["RESTY D. MORANCIL", "Information Technology Officer I, ODG-ICT"]),
        memoLine("DATE", ["23 September 2026"]),
        memoLine("SUBJECT", ["Project Progress Report – Support Ticketing System"]),

        textPara("Dear Ms. Etrata,", { before: 280, after: 160 }),
        textPara(
          "This letter serves as the official progress report for the Support Ticketing System (STS) project as of September 23, 2026.",
        ),
        textPara(
          "We are pleased to submit the official progress report for the Support Ticketing System (STS) project. Significant milestones have been achieved, including the successful completion of the core modules and the official deployment of the system on September 10, 2026.",
        ),

        heading("Project Milestones & Timeline"),
        grid(milestoneW, ["DATE", "ACTIVITY", "STATUS"], milestones),

        heading("Completed System Modules & Features"),
        textPara(
          "Core System Modules: Super Admin, Admin, Records, and Staff portals; Form Builder; My Forms; Pending Forms; Published Forms; Approvals; Request Management; Assigned to me; For Review; Submit Request; My Requests; Service Feedback; Messages; Reports and Analytics; Users, Roles, and Permissions; Activity Logs; and Settings.",
        ),
        textPara(
          "Additional Features: PAMANA employee autofill, print-template field placement, client approval for Recommending Officer, Immediate Supervisor, and Action Officer, role-based access, and the Employee User Manual (Version 2.3).",
        ),
        textPara("Key Functionalities Covered:", { after: 80 }),
        ...bullets.map(
          (item) =>
            new Paragraph({
              numbering: { reference: "sts-functions", level: 0 },
              spacing: { before: 40, after: 40, line: 276 },
              children: [run(item, { size: 24 })],
            }),
        ),

        heading("Current Status"),
        textPara(
          "System Deployment: The Support Ticketing System was successfully deployed on September 10, 2026, and is now accessible at http://on-prem.x-dcb.net:5173.",
        ),

        heading("Upcoming Activities"),
        grid(
          upcomingW,
          ["#", "Activity", "Responsible unit", "Status", "Target Completion Date"],
          upcoming,
        ),

        textPara("Sincerely,", { before: 400, after: 360 }),
        textPara("RESTY D. MORANCIL", { bold: true, before: 0, after: 0 }),
        textPara("Information Technology Officer I", { before: 0, after: 0 }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buffer);
console.log(out);
