/**
 * Progress report for the NMP Support Ticketing System.
 * Follows the section flow of the DVC project progress letter.
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

const statusW = [700, 3100, 2100, 1100, 1866, 1600];
const timelineW = [2500, 1100, 800, 1900, 1966, 2200];
const upcomingW = [620, 2500, 1100, 780, 1900, 1766, 1800];
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
          "This letter is the official progress report for the National Museum of the Philippines (NMP) Support Ticketing System (STS) as of 23 September 2026.",
        ),
        p(
          "System development is complete. The application now covers the Super Admin, Admin, Records, and Staff portals. Form building and publishing, request submission, client review, approval and assignment, service feedback, role-based access, messaging, reports, and the Employee User Manual (Version 2.3) are in place. The system is ready for User Acceptance Testing.",
        ),

        sectionTitle("Project Status Summary"),
        p("The following development items are completed:", { after: 120 }),
        table(
          statusW,
          ["Item No.", "Activities", "Action needed", "Responsible", "Date Completed", "Status"],
          [
            [
              "1",
              "Form Builder (six steps, print placement, supporting document) and form lifecycle",
              "None. Delivered for UAT.",
              "DVC",
              "22 September 2026",
              "Completed",
            ],
            [
              "2",
              "Records review and publishing (Pending Forms, Published Forms, recommendation)",
              "None. Delivered for UAT.",
              "DVC",
              "22 September 2026",
              "Completed",
            ],
            [
              "3",
              "Staff request workflow (submit, For Review, approvals, assignment, feedback, close)",
              "None. Delivered for UAT.",
              "DVC",
              "22 September 2026",
              "Completed",
            ],
            [
              "4",
              "PAMANA employee autofill, users, roles, and permissions",
              "None. Delivered for UAT.",
              "DVC",
              "22 September 2026",
              "Completed",
            ],
            [
              "5",
              "Employee User Manual, Version 2.3",
              "For NMP use during UAT and training.",
              "DVC",
              "22 September 2026",
              "Completed",
            ],
          ],
        ),

        sectionTitle("Phase Completion"),
        p(
          "With these items delivered, the development phase is closed. The working environment was cleared of sample forms, tickets, messages, and activity logs on 22 September 2026 so Client, Admin, and Records start clean. User accounts and role assignments were kept.",
        ),
        p(
          "No invoice is reported in this letter. Billing for the completed development phase will follow the approved project terms after NMP accepts the delivered system in writing.",
        ),

        sectionTitle("Project Timeline"),
        p(
          "Dates below are the working schedule. User Acceptance Testing, training, and go-live move only after NMP confirms the testers and the start date.",
          { after: 120 },
        ),
        table(
          timelineW,
          ["Activity", "Responsible", "No. of Days", "Period", "Target", "Status / Remarks"],
          [
            [
              "System development and Employee User Manual v2.3",
              "DVC",
              "—",
              "Completed",
              "22 September 2026",
              "Completed",
            ],
            [
              "Final verification (records review and document viewing)",
              "DVC",
              "1",
              "23 September 2026",
              "23 September 2026",
              "Completed",
            ],
            [
              "User Acceptance Testing",
              "NMP",
              "5",
              "24–30 September 2026",
              "30 September 2026",
              "Not started. Pending NMP confirmation.",
            ],
            [
              "End-user training (Super Admin, Admin, Record Admin, Staff)",
              "DVC",
              "3",
              "1–3 October 2026",
              "3 October 2026",
              "Not started. Follows UAT.",
            ],
            [
              "Official go-live",
              "DVC / NMP",
              "1",
              "6 October 2026",
              "6 October 2026",
              "Not started. Follows training and acceptance.",
            ],
          ],
        ),

        sectionTitle("Ongoing and Upcoming Activities"),
        table(
          upcomingW,
          ["Item No.", "Activity", "Responsible", "No. of Days", "Period", "Status", "Target"],
          [
            [
              "1",
              "User Acceptance Testing of all four portals",
              "NMP",
              "5",
              "24–30 September 2026",
              "Not started",
              "30 September 2026",
            ],
            [
              "2",
              "End-user training using the Employee User Manual v2.3",
              "DVC",
              "3",
              "1–3 October 2026",
              "Not started",
              "3 October 2026",
            ],
            [
              "3",
              "Acceptance of UAT findings, if any, and official go-live",
              "DVC / NMP",
              "1",
              "6 October 2026",
              "Not started",
              "6 October 2026",
            ],
          ],
        ),

        sectionTitle("Development Progress"),
        p(
          "As of 23 September 2026, development of the Support Ticketing System is complete and available for acceptance testing. The delivered scope is as follows.",
        ),
        p(
          "Super Admin manages users, roles, and permissions, and can open the Admin, Records, and Staff portals from one account. Admin builds any request form that fits the Form Builder, submits it to Records, approves requests, and assigns personnel. Records reviews pending forms and either approves and publishes them or disapproves them with remarks. Staff submit requests on published forms, take part in For Review when a form requires a Recommending Officer, Immediate Supervisor, or Action Officer, and close the request after service feedback.",
        ),
        p(
          "Requestor name, division, and related profile details fill in from PAMANA. The Employee User Manual, Version 2.3, dated 22 September 2026, is the reference for UAT and training. It covers sign-in, Form Builder, My Forms, Pending Forms, Published Forms, Approvals, Request Management, Assigned to me, For Review, Submit Request, My Requests, Service Feedback, Messages, Reports, and Settings.",
        ),

        sectionTitle("Requested from NMP"),
        p(
          "The items below are needed so User Acceptance Testing can start on 24 September 2026 and the 6 October 2026 go-live date can hold.",
          { after: 120 },
        ),
        table(
          pendingW,
          ["Item No.", "Requested item", "Responsible", "Date requested", "Status"],
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
