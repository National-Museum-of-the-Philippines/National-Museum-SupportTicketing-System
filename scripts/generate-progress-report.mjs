/**
 * Progress report for the NMP Support Ticketing System, from 15 May 2026.
 * Section order matches the DVC project progress letter.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
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

const NAVY = "1F3A5F";
const RULE = "C5CDD6";
const TEXT = "222222";
const MUTED = "5C6770";
const FONT = "Calibri";
const PAGE_W = 11906;
const MARGIN = 720;
const TABLE_W = PAGE_W - MARGIN * 2;

const thin = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
function run(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? 22,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? TEXT,
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before ?? 0, after: opts.after ?? 160, line: 276 },
    alignment: opts.align,
    children: [run(text, opts)],
  });
}

function lines(items, opts = {}) {
  return items.map(
    (text, i) =>
      new Paragraph({
        spacing: { before: i === 0 ? (opts.before ?? 0) : 0, after: 0, line: 240 },
        children: [run(text, opts)],
      }),
  );
}

function cell(text, width, opts = {}) {
  const header = opts.header ?? false;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: header ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [
          run(text, {
            size: header ? 15 : 16,
            bold: header || opts.bold,
            color: header ? "FFFFFF" : TEXT,
          }),
        ],
      }),
    ],
  });
}

function table(widths, header, rows) {
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: header.map((label, i) => cell(label, widths[i], { header: true })),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            cantSplit: true,
            children: row.map((value, i) => cell(String(value), widths[i])),
          }),
      ),
    ],
  });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 1 } },
    children: [run(text, { bold: true, size: 24, color: NAVY })],
  });
}

const header = new Header({
  children: [
    new Paragraph({
      spacing: { after: 20 },
      children: [run("DA VINCI COLORS", { bold: true, size: 28, color: NAVY })],
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [
        run("www.davincicolors.ph   ·   dvcinfo@davincicolors.ph   ·   +632 8921 7715", {
          size: 15,
          color: MUTED,
        }),
      ],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 } },
      spacing: { after: 80 },
      children: [
        run("Ground Floor, Esna Building, 30 Timog Avenue, Quezon City", {
          size: 15,
          color: MUTED,
        }),
      ],
    }),
  ],
});

const footer = new Footer({
  children: [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
      spacing: { before: 80 },
      alignment: AlignmentType.RIGHT,
      children: [
        run("NMP Support Ticketing System  ·  Progress Report  ·  Page ", { size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED }),
        run(" of ", { size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: MUTED }),
      ],
    }),
  ],
});

const statusW = [700, 3400, 1900, 1100, 1866, 1500];
const timelineW = [2200, 900, 700, 2100, 2100, 2466];
const upcomingW = [620, 2400, 1100, 780, 2000, 1566, 2000];
const pendingW = [620, 4300, 1200, 1800, 2546];

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: 900, bottom: 800, left: MARGIN, right: MARGIN, header: 360, footer: 360 },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 },
          children: [run("23 September 2026", { size: 22 })],
        }),

        ...lines(
          [
            "Angelo Macario",
            "Project Manager / Single Point of Contact",
            "National Museum of the Philippines (NMP)",
            "P. Burgos Drive, Rizal Park, Manila",
          ],
          { size: 22 },
        ),

        p("Thru:", { before: 200, after: 40, bold: true }),
        ...lines(
          ["Resty Morancil", "IT Officer", "National Museum of the Philippines (NMP)"],
          { size: 22 },
        ),

        new Paragraph({
          spacing: { before: 220, after: 200 },
          children: [
            run("Subject:  ", { bold: true, size: 22 }),
            run("Project Progress Report – NMP Support Ticketing System", { bold: true, size: 22 }),
          ],
        }),

        p("Dear Mr. Macario,", { after: 160 }),

        p(
          "This letter serves as the official progress report for the National Museum of the Philippines (NMP) Support Ticketing System as of 23 September 2026.",
        ),
        p(
          "Development began on 15 May 2026 with the initial Technical Assistance Request System. That work is now delivered as the Support Ticketing System. We are pleased to report that development from 15 May 2026 through 22 September 2026 is complete, covering the Super Admin, Admin, Records, and Staff portals, the full request workflow, PAMANA employee autofill, and the Employee User Manual (Version 2.3).",
        ),

        sectionTitle("Project Status Summary"),
        p("The following milestones have been completed:", { after: 120 }),
        table(
          statusW,
          ["Item No.", "Activities", "Action needed", "Responsible", "Date Completed", "Status"],
          [
            [
              "1",
              "Project start: Technical Assistance Request System",
              "None",
              "DVC",
              "15 May 2026",
              "Completed",
            ],
            [
              "2",
              "Admin, Records, and Client portals, and the core request workflow",
              "None",
              "DVC",
              "30 June 2026",
              "Completed",
            ],
            [
              "3",
              "Real-time messaging, dashboards, and Settings",
              "None",
              "DVC",
              "28 July 2026",
              "Completed",
            ],
            [
              "4",
              "Migration to Laravel and MySQL",
              "None",
              "DVC",
              "26 August 2026",
              "Completed",
            ],
            [
              "5",
              "PAMANA autofill, Super Admin portal, and role-based access",
              "None",
              "DVC",
              "3 September 2026",
              "Completed",
            ],
            [
              "6",
              "Client review queues, Assigned to me, and section personnel lists",
              "None",
              "DVC",
              "18 September 2026",
              "Completed",
            ],
            [
              "7",
              "Employee User Manual, Version 2.3",
              "For NMP use during UAT and training",
              "DVC",
              "22 September 2026",
              "Completed",
            ],
          ],
        ),

        sectionTitle("Phase Completion and Billing"),
        p(
          "With the completion of the work above, the development phase that started on 15 May 2026 is now formally closed. On 22 September 2026 the working environment was cleared of sample forms, tickets, messages, and activity logs so Client, Admin, and Records can start clean. User accounts and role assignments were kept.",
        ),
        p(
          "The system is ready for User Acceptance Testing. Billing for the completed development phase will be issued to the National Museum of the Philippines upon written acceptance of the delivered system.",
        ),

        sectionTitle("Project Timeline (Baseline vs Actual Adjustment)"),
        p(
          "Original Period is the window in which each activity was carried out. Revised Period is the same window where the work finished as carried out. User Acceptance Testing, training, and go-live remain proposed until NMP confirms the schedule.",
          { after: 120 },
        ),
        table(
          timelineW,
          ["Activity", "Responsible", "No. of Days", "Original Period", "Revised Period", "Status / Remarks"],
          [
            [
              "Project start and initial Technical Assistance Request System",
              "DVC",
              "28",
              "15 May – 11 June 2026",
              "15 May – 11 June 2026",
              "Completed",
            ],
            [
              "Portals and core request workflow (forms, approvals, assignment, feedback)",
              "DVC",
              "20",
              "11–30 June 2026",
              "11–30 June 2026",
              "Completed",
            ],
            [
              "Messaging, dashboards, and Settings",
              "DVC",
              "27",
              "2–28 July 2026",
              "2–28 July 2026",
              "Completed",
            ],
            [
              "Migration to Laravel and MySQL",
              "DVC",
              "20",
              "7–26 August 2026",
              "7–26 August 2026",
              "Completed",
            ],
            [
              "PAMANA, Super Admin, review queues, and Employee User Manual v2.3",
              "DVC",
              "22",
              "1–22 September 2026",
              "1–22 September 2026",
              "Completed",
            ],
            [
              "User Acceptance Testing",
              "NMP",
              "5",
              "24–30 September 2026",
              "24–30 September 2026",
              "Not Started",
            ],
            [
              "End-user training",
              "DVC",
              "3",
              "1–3 October 2026",
              "1–3 October 2026",
              "Not Started",
            ],
            [
              "Official go-live",
              "DVC / NMP",
              "1",
              "6 October 2026",
              "6 October 2026",
              "Not Started",
            ],
          ],
        ),

        sectionTitle("Ongoing and Upcoming Activities"),
        table(
          upcomingW,
          [
            "Item No.",
            "Activity",
            "Responsible",
            "No. of Days",
            "Period",
            "Status",
            "Target Completion Date",
          ],
          [
            [
              "1",
              "User Acceptance Testing of Super Admin, Admin, Records, and Staff",
              "NMP",
              "5",
              "24–30 September 2026",
              "Not Started",
              "30 September 2026",
            ],
            [
              "2",
              "End-user training using the Employee User Manual v2.3",
              "DVC",
              "3",
              "1–3 October 2026",
              "Not Started",
              "3 October 2026",
            ],
            [
              "3",
              "Official go-live",
              "DVC / NMP",
              "1",
              "6 October 2026",
              "Not Started",
              "6 October 2026",
            ],
          ],
        ),

        sectionTitle("Development Progress Details"),
        p(
          "As of 23 September 2026, development stands complete. The project opened on 15 May 2026 as the Technical Assistance Request System. In June the application was rebuilt as a full system with Admin, Records, and Client portals, including form building, approvals, assignment, printable forms, and client feedback. In July, real-time messaging and the shared dashboard and Settings layout were added.",
        ),
        p(
          "In August the system was moved to Laravel and MySQL. In September, requestor details were connected to PAMANA, the Super Admin portal and role-based access were added, and the client review path was completed for Recommending Officer, Immediate Supervisor, and Action Officer, together with Assigned to me. The Employee User Manual, Version 2.3, was issued on 22 September 2026.",
        ),
        p(
          "Admin builds a form and sends it to Records. Records approves and publishes the form, or disapproves it with remarks. Staff submit a request on any published form. Where the form requires it, the request passes through For Review, then Admin approval and assignment. The requestor confirms the service, submits feedback, and closes the ticket. The delivered system is ready for User Acceptance Testing.",
        ),

        sectionTitle("Requested Documents and Pending Deliverables"),
        p(
          "The following items are requested from NMP so User Acceptance Testing can start on 24 September 2026 and the 6 October 2026 go-live date can be kept.",
          { after: 120 },
        ),
        table(
          pendingW,
          ["Item No.", "Requested Document", "Responsible", "Date Requested", "Status"],
          [
            [
              "1",
              "UAT schedule and named testers for Super Admin, Admin, Record Admin, and Staff",
              "NMP",
              "23 September 2026",
              "Pending",
            ],
            [
              "2",
              "Written acceptance of the delivered system, or a list of UAT findings",
              "NMP",
              "23 September 2026",
              "Pending",
            ],
            [
              "3",
              "Confirmed go-live date",
              "NMP",
              "23 September 2026",
              "Pending",
            ],
          ],
        ),

        p("Sincerely,", { before: 360, after: 280 }),
        p("John Paul Dl. Sarno", { before: 0, after: 0, bold: true }),
        p("Project Manager", { before: 0, after: 0, color: MUTED }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buffer);
console.log(out);
