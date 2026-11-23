/** STS UAT – Admin. Layout follows the NMP UAT template. Aligned to current Admin portal UI. */
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
const out = path.join(root, "docs/STS_UAT_Admin.docx");
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

const sections = [
  ["Access the System", [
    ["Access the Support Ticketing System", ["Open any web browser available in your computer and enter the official STS web address provided by the ICT Section."],
      "You will be redirected to the Log-in Page of the Support Ticketing System, displaying the Welcome Back form with the Username and Password fields, the Show Password (eye) icon, Remember me, and the Sign In button, over the Quality Policy background."],
    ["Verify the Log-in Page branding", ["Check the form and footer of the Log-in Page."],
      "The page shows the National Museum of the Philippines Support Ticketing System branding (NMP logo and Welcome Back heading) and the Privacy Policy and Terms of Use links in the footer."],
  ]],
  ["Login", [
    ["Login to STS", ["Enter your correct credentials (username and password);", "Click the Sign In button."],
      "The Sign In button shows Signing in… while processing. You will be logged in and redirected to the landing page of your assigned role (Staff/Client, Admin, Records, or Super Admin).",
      ["Format:", "Username:", "“Museum organization username”", "Password:", "“PAMANA password”"]],
    ["Login with an incorrect password", ["Enter your correct username and an incorrect password;", "Click the Sign In button."], "The system does not sign you in and displays the message Incorrect email or password."],
    ["Login with an incorrect username", ["Enter an unregistered username and any password;", "Click the Sign In button."], "The system does not sign you in and displays the message Incorrect email or password."],
    ["Login with a blank username", ["Enter your password and leave the username field blank;", "Click the Sign In button."], "The system does not sign you in and prompts you to fill in the Username field."],
    ["Login with a blank password", ["Enter your correct username and leave the password field blank;", "Click the Sign In button."], "The system does not sign you in and prompts you to fill in the Password field."],
    ["Login with both fields blank", ["Leave both username and password fields blank;", "Click the Sign In button."], "The system does not sign you in and prompts you to fill in the required fields."],
    ["Show and hide your password", ["Type a password in the Password field;", "Click the eye icon."], "The password characters are shown. Clicking the eye icon again hides them."],
    ["Use the Remember me option", ["Enter your credentials and tick Remember me;", "Sign in, then log out;", "Open the Log-in Page again in the same browser."], "Your username is saved on this browser and is already filled in on the Log-in Page."],
    ["Logout", ["Click Logout at the bottom of the left sidebar."], "Your session is ended and you are returned to the Log-in Page."],
  ]],
  ["Multi-Factor Authentication (MFA)", [
    ["Open the Set up MFA dialog", ["Log in using valid account credentials;", "Click Set up MFA at the bottom of the left sidebar."], "The MFA dialog is displayed. It explains that an authenticator app (Google Authenticator or Microsoft Authenticator) will ask for a code in addition to your password when signing in."],
    ["Complete the MFA setup", ["Enter your current password and click Set up MFA;", "Scan the QR code or enter the Setup key in your authenticator app;", "Save the Recovery codes shown on the dialog (they are shown only once);", "Enter the Code from the app and click Confirm and enable."], "MFA is turned on for your account. The message Multi-factor authentication enabled is displayed."],
    ["Login with MFA turned on", ["Enter your correct username and password;", "Click the Sign In button;", "Enter the 6-digit code from your authenticator app in the Authentication code field."], "After the correct credentials, the page asks for the Authentication code (placeholder: 6-digit code or recovery code). After the correct code is entered, you are logged in."],
    ["Login using a recovery code", ["Enter your correct username and password;", "Enter one of your saved recovery codes in the Authentication code field."], "The page accepts a recovery code in place of the 6-digit code and logs you in."],
    ["Login with an incorrect code", ["Enter your correct username and password;", "Enter an incorrect Authentication code."], "The system does not complete the sign-in, displays The authentication code is incorrect., and does not open the dashboard."],
  ]],
  ["Settings and Account Profile", [
    ["Open the Settings page", ["Click Settings at the bottom of the left sidebar."], "The Settings page is displayed with the Account panel showing Email, Role, Display name, Division / office, Designation, and the Save profile button."],
    ["Verify the read-only fields", ["Try to edit the Email and Role fields."], "Email and Role are displayed but cannot be edited. Role shows Admin."],
    ["Update your profile", ["Update the Display name, Division / office, and Designation;", "Click the Save profile button."], "The button shows Saving… and the profile is saved. The message Profile updated is displayed. The updated display name appears in the portal header and in the activity logs."],
    ["Save the profile with required fields blank", ["Clear the Display name or the Division / office field;", "Click the Save profile button."], "The profile is not saved. The message Name and division are required is displayed."],
    ["Verify the Password section", ["Check the Password section of the Settings page."], "The page states that the sign-in password is the PAMANA password and cannot be changed in STS. To change it, change the password in PAMANA and then sign in with the new password."],
  ]],
  ["Notifications", [
    ["Open the notification bell", ["Log in as Admin;", "Click the notification bell in the header."], "The Notifications dropdown opens, showing the number of items (or You're all caught up). It lists pending client approvals, tickets ready for personnel assignment, assigned work, new messages, and pokes."],
    ["Open an update from the bell", ["Click a ticket update in the dropdown."], "The dropdown closes and the related Approvals or Request Management page opens. A message or poke update opens the Messages window instead."],
    ["Verify the empty notifications", ["Open the bell when you have no updates."], "The dropdown shows No pending client requests."],
    ["View all notifications", ["Click View all at the bottom of the dropdown when items are listed."], "The Approvals page is displayed."],
  ]],
  ["Messages", [
    ["Open the Messages window", ["Click MAIN, then Messages, in the left sidebar (or click the chat button at the lower right of the screen)."], "The floating Messages window opens over the page with the New button, the Search chats box, and your chats grouped under Requests and Direct messages. The unread count appears on the chat button and the sidebar. (Messages is not a separate full page.)"],
    ["Verify the empty chat list", ["Open the Messages window when you have no chats."], "The window shows No chats yet. Start one with New."],
    ["Search your chats", ["Type a name or request in the Search chats box."], "The list is filtered to match. When nothing matches, the window shows No chats match your search."],
    ["Open the New message window", ["Click the New button."], "The New message window is displayed with the note Message or poke anyone: admin, records, or client., the search box (Search by name, email, or division…), and the Admin and Clients groups, each user with a Poke button."],
    ["Search for a user", ["In the New message window, type a name, email, or division in the search box."], "The list is filtered to match what you typed. When there is no match, it shows No people found."],
    ["Start a direct conversation", ["Click the name row of a user."], "A private direct chat with that user is created and opened. When there are no messages yet, it shows No messages yet and Send the first message below."],
    ["Send a message", ["Type a message in the Message <name>… field;", "Click the Send button or press Enter."], "The message appears in the thread instantly and is delivered in real time to the other person."],
    ["Mention a user", ["Click the @ button or type @ in the message field;", "Select a person from the list;", "Send the message."], "The selected person is tagged in the message."],
    ["Poke a user", ["Click the Poke button beside a user in the New message window, or the Poke button in the chat header."], "The message Poked <name>! is displayed. The user receives an instant alert in the notification bell without a full conversation."],
    ["Open the request chat", ["Open a ticket from Approvals, Request Management, or Assigned to me;", "Click the Request messages button."], "The chat for that request opens with the status, the form title, and the message field Message about this request…."],
    ["Receive a new message", ["Have another user send you a message while you are on another page."], "The unread badge on the chat button updates. When you are scrolled up in a thread, the New messages button appears and scrolls you to the latest message when clicked."],
    ["Close the Messages window", ["Click the X button, or click outside the window."], "The window closes and the chat button is shown again."],
  ]],
  ["Admin: Dashboard and Navigation", [
    ["Verify the Admin dashboard after login", ["Log in as Admin."], "The Admin dashboard is displayed with the welcome banner (Good day, <first name>), the Review approvals and Open Form Builder buttons, the Requests to approve, Pending review, and Draft forms stats, and the Today's activity panel."],
    ["Verify the sidebar menu", ["Expand MAIN, FORMS, and REQUESTS in the left sidebar."], "MAIN shows Dashboard, Reports, and Messages. FORMS shows Form Builder and Published Forms. REQUESTS shows Approvals, Request Management, Assigned to me, My Requests, and Submit Request. Settings, Set up MFA, and Logout are at the bottom. Menu items show a count when something needs your action."],
    ["Open Approvals from the dashboard", ["Click Review approvals in the welcome banner, or click the Requests to approve stat."], "The Approvals page is opened."],
    ["Open Form Builder from the dashboard", ["Click Open Form Builder in the welcome banner, or click the Pending review or Draft forms stat."], "The Form Builder page is opened."],
    ["Verify the assigned-requests alert", ["Have a ticket assigned to your account;", "Open the dashboard."], "The alert You have assigned requests is shown with the Open My Assignments button."],
    ["Verify the form-revision alert", ["Have a form returned by Records with status Disapproved;", "Open the dashboard."], "The alert that forms need revision is shown with the Records remarks and the Open Form Builder button."],
    ["Verify the pending-approvals alert", ["Have client requests waiting for your Action Officer approval;", "Open the dashboard."], "The alert that client requests are awaiting approval is shown with the Open Approvals button."],
    ["Verify Today's activity", ["Check the Today's activity panel."], "Recent Admin actions for the current day are listed. When there is none, the panel shows that there is no activity yet today."],
    ["Verify the profile menu", ["Click the profile area in the top-right header."], "The user name and role details are displayed."],
  ]],
  ["Admin: Form Builder", [
    ["Open the Form Builder", ["Click FORMS, then Form Builder, in the left sidebar."], "The New request form page is displayed with the six steps: General, Fields, Print Template, Client Request Approval, Workflow, and Supporting Doc, and the progress shows Step 1 of 6."],
    ["Verify the General information step", ["Check the General information section."], "The section shows Form title, Reference number (auto-generated), Date effectivity, Version number, and Division/Section (taken from your PAMANA login / section)."],
    ["Complete the General information", ["Enter a Form title;", "Select a Date effectivity;", "Click the Continue button."], "The system opens the Fields step (Step 2 of 6)."],
    ["Continue without a title or effectivity", ["Leave Form title or Date effectivity blank;", "Click the Continue button."], "The system does not proceed and displays Enter a form title before continuing. or Choose a date effectivity before continuing."],
    ["Verify the Form elements", ["Open the Fields step and check the Form elements panel."], "The panel lists Textbox, Textarea, Dropdown, Checkbox, Radio, Date Picker, Time Picker, Date & Time, File Upload, Email, Number, and Signature."],
    ["Add form fields", ["Click an element, such as Textbox, in the Form elements panel;", "Add other element types."], "Each element is added to the Live preview, which shows what employees will see when filling in the form."],
    ["Edit the field settings", ["Select a field in the Live preview;", "Change its Label and Placeholder;", "Tick Required field."], "The Field settings panel shows the Label, Placeholder, Required field option, and the field Variable. The Live preview updates with your changes."],
    ["Reorder the fields", ["Drag a field row in the Live preview to a new position."], "The fields are shown in the new order."],
    ["Continue without adding a field", ["Open the Fields step without adding any field;", "Click the Continue button."], "The system does not proceed and displays Add at least one form field before continuing."],
    ["Go back to the previous step", ["Click the Back button."], "The previous step is displayed and the information you entered is kept."],
    ["Upload the printable PDF template", ["Open the Print Template step;", "Upload a printable PDF form (maximum 25 MB)."], "The PDF is displayed in the template editor. A multi-page PDF is shown with its pages stacked for field mapping."],
    ["Upload a template larger than 25 MB", ["Open the Print Template step;", "Upload a PDF larger than 25 MB."], "The system does not accept the file and displays File is too large (max 25 MB). Try compressing the PDF."],
    ["Map the fields on the template", ["Place each form field on its position in the printable template;", "Review the alignment and spacing;", "Click Continue."], "Each field is shown at its mapped position on the template. Continuing without a template or placements shows Upload a form template before continuing. or Place at least one field on the template before continuing."],
    ["Configure the Client Request Approval", ["Open the Client Request Approval step;", "Set Recommending Officer to Yes;", "Set Immediate Supervisor to Yes."], "The Recommending Officer and Immediate Supervisor stages are enabled and shown in the Live Workflow Preview (Client → Recommending Officer → Immediate Supervisor → Process Owner)."],
    ["Verify the Immediate Supervisor option", ["Set Recommending Officer to No;", "Check the Immediate Supervisor option."], "The Immediate Supervisor option is hidden. It can only be enabled while Recommending Officer is Yes."],
    ["Configure the Workflow", ["Open the Workflow step;", "Select at least one Action Officer from your PAMANA section;", "Arrange the Action Officers in the processing order (AO1 → AOn)."], "The Action Officers are listed in the configured order. Earlier officers are Approval; the last Action Officer is Request Management and is responsible for personnel assignment after approvals."],
    ["Continue Workflow without an Action Officer", ["Open the Workflow step without selecting an Action Officer;", "Click the Continue button."], "The system does not proceed and displays Select at least one Action Officer before continuing."],
    ["Add the Supporting Doc", ["Open the Supporting Doc step;", "Upload an optional supporting PDF (maximum 25 MB)."], "The supporting PDF is attached to the form. The step is optional, so the form can also continue without it. A non-PDF is rejected with Only PDF files are allowed."],
    ["Save the form as a draft", ["On the last step, click Save as draft instead."], "The form is saved with the status Draft. The message \"<title>\" saved as draft is displayed. Drafts do not appear in Records. The Draft forms count on the dashboard increases."],
    ["Submit the form to Records", ["Complete all six steps;", "Click Submit to Records."], "The form status changes to Pending Review. The message \"<title>\" submitted to Records is displayed. The form appears in the Pending Forms of the Record Admin."],
  ]],
  ["Admin: Published Forms", [
    ["Open Published Forms", ["Click FORMS, then Published Forms, in the left sidebar."], "The Published Forms page is displayed with the list of live TA forms that clients can submit, the search box (Search forms), and the columns Form, Ref, Effectivity, Version, and Action."],
    ["Search published forms", ["Type a form title or reference number in the Search forms box."], "The list is filtered to match. When nothing matches, it shows No forms match your search."],
    ["View a published form file", ["Click View file on a published form."], "A read-only preview of the published printable form is displayed."],
    ["Verify the empty list", ["Open Published Forms when no forms are published."], "The page shows No published forms yet. Forms approved by Records will appear here once published."],
  ]],
  ["Admin: Approvals", [
    ["Open the Approvals queue", ["Click REQUESTS, then Approvals, in the left sidebar."], "The Approvals page is displayed as the Action Officer queue, with the pending count in the header and the table showing Ticket, Client, Division, Status, and Action."],
    ["Refresh the queue", ["Click the Refresh button in the upper right corner."], "The button shows Refreshing… while loading. The table is updated with the latest submissions."],
    ["Open Request Management from the queue", ["Click the View all requests → link at the bottom."], "The Request Management page is opened."],
    ["View the submitted file", ["Click View file beside a ticket."], "A read-only preview of the generated request form is displayed."],
    ["Approve a request (intermediate Action Officer)", ["As an intermediate Action Officer, click Approve beside a request."], "The message Request approved is displayed. The ticket remains in the approval workflow for the next Action Officer."],
    ["Approve a request (final Action Officer)", ["As the last Action Officer (Request Management role in the form workflow), click Approve."], "The message Approved — ready for task assignment is displayed and you are taken to Request Management to assign personnel."],
    ["Reject a request without a reason", ["Click Reject beside a request;", "Leave the Reason for rejection blank."], "Confirm reject stays disabled. The request is not rejected, because a rejection reason is required."],
    ["Reject a request with a reason", ["Click Reject beside a request;", "Enter the reason;", "Click Confirm reject."], "The message Request rejected is displayed. The ticket status becomes Rejected and the reason is provided to the requestor."],
    ["Verify the empty queue", ["Open the Approvals page when no approvals are pending."], "The page shows No pending approvals. New client requests will appear here for your review."],
  ]],
  ["Admin: Request Management and Assignment", [
    ["Open Request Management", ["Click REQUESTS, then Request Management, in the left sidebar."], "The page shows the master tracking queue with the request count in the header and the table showing Ticket, Client, Division, Status, and Action."],
    ["View the request file", ["Click View file on a ticket."], "A read-only preview of the generated request form and any attached files is displayed."],
    ["Use the preview controls", ["Click the − and + buttons;", "Click Reset;", "Scroll through the preview."], "The document zoom is changed and the scale percentage is updated. Reset returns the view to its default, and all pages of the form can be checked."],
    ["Close the preview", ["Click the X button of the preview."], "The preview is closed and you return to the Request Management queue."],
    ["Open the ticket details", ["Click Manage → on a ticket."], "The full ticket details page is displayed, where you can assign personnel (when ready), update the status (where allowed), and open Request messages."],
    ["Assign personnel to a ticket", ["Open a ticket that is ready for task assignment;", "Select one or more personnel from your PAMANA section list;", "Click Assign."], "Only active personnel from your section are listed. The message Personnel assigned is displayed. The ticket status becomes In Progress, and the ticket appears in Assigned to me of the assigned personnel."],
    ["Update the ticket status", ["Open an assigned ticket where you are Request Management;", "Change the status to in progress or pending where allowed;", "Confirm the change."], "The message Status updated is displayed. The new status is shown in the ticket list. (The client marks the service complete, submits feedback, and closes the request.)"],
    ["Verify the empty list", ["Open Request Management when there are no managed requests."], "The page shows No requests yet. Approved client submissions will appear here for assignment and tracking."],
  ]],
  ["Assigned to me", [
    ["Open Assigned to me", ["Click Assigned to me in the left sidebar."], "The personal work table is displayed with the number of active assignments in the header and the columns Ticket, Client, Client division, Status, and Action."],
    ["Verify an assigned ticket", ["Have a ticket assigned to your account;", "Open the Assigned to me page."], "The ticket appears in the table with the status In Progress."],
    ["Work on an assigned ticket", ["Click Open → in the Action column;", "Optionally click View file;", "Click Request messages to coordinate with the client."], "The ticket detail page opens. Notes or coordination happen through Request messages. When work is finished, the client marks the service complete, submits feedback, and closes the request."],
    ["Verify the empty list", ["Open the Assigned to me page when no ticket is assigned to you."], "The page shows No assigned requests. When an admin assigns you to a request, it will appear here as In Progress."],
  ]],
  ["Admin: My Requests and Submit Request", [
    ["Open My Requests", ["Click REQUESTS, then My Requests, in the left sidebar."], "The page lists your own support request submissions (separate from Request Management), with a way to open Submit Request."],
    ["Open Submit Request", ["Click REQUESTS, then Submit Request, in the left sidebar."], "The Submit Request page is displayed so you can file a request as a requester using published forms."],
    ["Submit a request as Admin", ["Select a published form;", "Complete the required fields;", "Click Submit request."], "The request is filed under your account and appears in My Requests with the first step of the configured workflow."],
  ]],
  ["Admin: Reports", [
    ["Open Reports", ["Click MAIN, then Reports, in the left sidebar."], "The Reports page is displayed for your published forms. When you have no published forms, it shows You have no published forms yet. Publish a form from the Form Builder to build its report."],
    ["Select a form and period", ["Choose a Form from the dropdown;", "Choose a Year and Month (or All months)."], "The report scope updates to the selected form and period. The closed-ticket count for that range is shown when a report format exists."],
    ["Configure Report settings", ["Click Report settings;", "For each form field, choose a display type (Donut chart, Pie chart, Bar chart, Column chart, Number tiles, Table list, or Not shown);", "Click Save on each row you want, then Apply changes."], "The report format is saved. The page shows the configured cards for closed tickets of that form."],
    ["Verify a form with no report format", ["Select a published form that has no report settings yet."], "The page shows No available report with steps to click Report settings, pick a chart or table for each field, and Apply changes."],
    ["Verify chart cards", ["Open a form that already has report settings and closed tickets."], "Each configured field is shown as its selected chart or table. Fields set to Not shown are counted as hidden."],
  ]],
];

const modules = "Login, Account Settings, Notifications, Messages, Dashboard, Form Builder, Published Forms, Approvals, Request Management and Assignment, Assigned to me, My Requests, Submit Request, Reports";
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
  info("Role Tested", "Admin", "", ""),
] });

const logo = fs.readFileSync(path.join(root, "public/nmp-logo.png"));
const FOOT = "Support Ticketing System – User Acceptance Testing (Admin)";
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
