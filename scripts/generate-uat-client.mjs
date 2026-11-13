/** STS UAT – Staff (Client). Layout follows the NMP UAT template. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageOrientation,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "docs/STS_UAT_Staff_Client.docx");
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
      "You will be redirected to the Log-in Page of the Support Ticketing System, displaying the Welcome Back form with the Username and Password fields, the Show Password (eye) icon, Remember me, and the Sign In button, beside the Quality Policy panel."],
    ["Verify the Log-in Page branding", ["Check the header, form, and footer of the Log-in Page."],
      "The page shows the National Museum of the Philippines Support Ticketing System branding and the Privacy Policy and Terms of Use links in the footer."],
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
    ["Complete the MFA setup", ["Follow the on-screen steps to start the setup;", "Scan or enter the key in your authenticator app;", "Enter the code shown in the app to confirm."], "MFA is turned on for your account. The dialog shows recovery codes that you must keep in a safe place."],
    ["Login with MFA turned on", ["Enter your correct username and password;", "Click the Sign In button;", "Enter the 6-digit code from your authenticator app."], "After the correct credentials, the page asks for the code from your authenticator app. After the correct code is entered, you are logged in."],
    ["Login using a recovery code", ["Enter your correct username and password;", "Enter one of your saved recovery codes in place of the 6-digit code."], "The page accepts a recovery code in place of the 6-digit code and logs you in."],
    ["Login with an incorrect code", ["Enter your correct username and password;", "Enter an incorrect code."], "The system does not complete the sign-in, displays The authentication code is incorrect., and does not open the dashboard."],
  ]],
  ["Settings and Account Profile", [
    ["Open the Settings page", ["Click Settings at the bottom of the left sidebar."], "The Settings page is displayed with the Account panel showing Email, Role, Display name, Division / office, Designation, and the Save profile button."],
    ["Verify the read-only fields", ["Try to edit the Email and Role fields."], "Email and Role are displayed but cannot be edited."],
    ["Update your profile", ["Update the Display name, Division / office, and Designation;", "Click the Save profile button."], "The button shows Saving… and the profile is saved. The updated display name appears in the portal header and in the activity logs."],
    ["Save the profile with required fields blank", ["Clear the Display name or the Division / office field;", "Click the Save profile button."], "The profile is not saved, because the Display name and Division / office are required."],
    ["Verify the Password section", ["Check the Password section of the Settings page."], "The page states that the sign-in password is the PAMANA password and cannot be changed in STS. To change it, change the password in PAMANA and then sign in with the new password."],
  ]],
  ["Notifications", [
    ["Notifications for Staff", ["Log in as Staff;", "Click the notification bell in the header."], "The notification dropdown displays actionable updates on your requests. When there are none, it shows No updates on your requests."],
  ]],
  ["Messages", [
    ["Open the Messages page", ["Click MAIN, then Messages, in the left sidebar."], "The Messages page is displayed with the Chats pane, the + New button, and the NMP Team Chat (Admin, Records & Clients)."],
    ["Open the NMP Team Chat", ["Click NMP Team Chat in the Chats pane."], "The conversation thread loads in the main message pane. When there are no messages yet, it shows Say hello to the team. Messages appear instantly for everyone."],
    ["Send a message", ["Type a message in the Message the NMP team… field;", "Click the Send button or press Enter."], "The message is published in the thread and appears instantly to all thread participants."],
    ["Mention a user", ["Type @ in the message field;", "Select a team member or user role to tag;", "Send the message."], "The selected user or role is tagged in the message."],
    ["Open the New message window", ["Click the + New button."], "The New message window is displayed with the search box (Search by name, email, or division…) and the ADMIN and CLIENTS account groups, each user with a Poke button."],
    ["Search for a user", ["In the New message window, type a name, email, or division in the search box."], "The list of accounts is filtered to match what you typed."],
    ["Start a direct conversation", ["Click the name row of a user."], "A private direct messaging thread with that user is created and opened."],
    ["Poke a user", ["Click the Poke button beside a user."], "An instant priority alert is sent to that user without opening a full messaging session. The user sees the poke in the notification bell."],
  ]],
  ["Staff: Dashboard and Navigation", [
    ["Verify the Staff dashboard after login", ["Log in as Staff."], "The dashboard is displayed with the welcome banner (CLIENT tag, name, date, and division), the + New request button, the Active requests, Pending approval, and Completed cards, and the Recent requests panel."],
    ["Verify the sidebar menu", ["Expand MAIN and REQUESTS in the left sidebar."], "MAIN shows Dashboard, Assigned to me, and Messages. REQUESTS shows For Review (Recommending), For Review (Supervisor), For Review (Action Officer), Submit Request, My Requests, and Service Feedback. Settings, Set up MFA, and Logout are at the bottom."],
    ["Open the queues from the metric cards", ["Click View all in the Active requests, Pending approval, and Completed cards."], "Each card opens its related list of requests."],
    ["Open a new request from the dashboard", ["Click the + New request button."], "The list of published forms is displayed so you can start a new request."],
    ["Verify the empty Recent requests panel", ["Check the Recent requests panel when you have no requests."], "The panel shows No requests available. with the Submit a request button."],
  ]],
  ["Staff: Submit Request", [
    ["Open the Submit Request page", ["Click REQUESTS, then Submit Request, in the left sidebar."], "The Submit Request page is displayed, showing that you are submitting as your own name and that the request appears in your list only, with the Choose a form panel and the Published form dropdown."],
    ["Verify the form list", ["Click the Published form dropdown (Select a form…)."], "Only the forms with the status Published are listed."],
    ["Select a form", ["Select a published form."], "The intake fields and document requirements of the form are loaded. The View form file button previews the printable template."],
    ["Verify the PAMANA autofill", ["Select a published form;", "Check the requestor details."], "Division/Section, Designation, First Name, Middle Name, Last Name, and Email Address are filled in automatically from your PAMANA employee record."],
    ["Verify an account without a PAMANA record", ["Log in with an account that is not linked to a PAMANA staff record;", "Select a published form."], "The requestor detail fields are empty and cannot be filled in automatically."],
    ["Complete the form", ["Fill in the remaining required fields;", "Upload the supporting attachments if the form requires them (maximum 25 MB)."], "The entered information and the attachments are accepted."],
    ["Submit with a required field empty", ["Leave a required field blank;", "Click the Submit request button."], "The request is not submitted and the missing required field is indicated."],
    ["Preview the form before submitting", ["Open the form file preview."], "The preview shows your answers, including the PAMANA fields, at the positions mapped by the Admin on the printable layout."],
    ["Submit the request", ["Click the Submit request button."], "The ticket is created and appears in My Requests. Its status shows the first step of the configured workflow: For Client Approval when the Recommending Officer or Immediate Supervisor is enabled, otherwise For Process Owner."],
    ["Verify the empty form list", ["Open the Submit Request page when no forms are published."], "The page shows No forms available. Published forms appear once Records approves them."],
  ]],
  ["Staff: My Requests", [
    ["Open My Requests", ["Click REQUESTS, then My Requests, in the left sidebar."], "The page lists the tickets filed under your account with the ticket number, service details, approval status, and assigned personnel, with the New request button."],
    ["Open a ticket", ["Click a ticket in the list."], "The uploaded form, the submitted answers, the assigned personnel, and the requestor actions (Mark service complete, feedback, Close ticket, or Reopen request) are displayed."],
    ["Verify the ticket status", ["Check the status of a ticket while it moves through the workflow."], "The status shows the current step of the workflow, such as For Client Approval, For Process Owner, Open, In Progress, Resolved, Closed, Rejected, or Reopened."],
    ["Start a new request from My Requests", ["Click the New request button."], "The form selection panel is opened."],
    ["Verify the empty list", ["Open My Requests when you have no requests."], "The page shows No personal requests yet. with the Submit request button."],
  ]],
  ["Staff: For Review Queues", [
    ["Open For Review (Recommending)", ["Log in as a Staff user named as Recommending Officer;", "Click REQUESTS, then For Review (Recommending)."], "The For Review — Recommending Officer page lists the requests that need your initial endorsement."],
    ["Approve as Recommending Officer", ["Open a request;", "Approve the request."], "The request moves to the next step. When the Immediate Supervisor stage is enabled, it appears in For Review (Supervisor)."],
    ["Open For Review (Supervisor)", ["Log in as a Staff user named as Immediate Supervisor;", "Click REQUESTS, then For Review (Supervisor)."], "The For Review — Immediate Supervisor page lists the division or section requests waiting for your supervisory clearance."],
    ["Approve as Immediate Supervisor", ["Open a request;", "Approve the request."], "The request moves to the Action Officer steps, and its status shows For Process Owner."],
    ["Open For Review (Action Officer)", ["Log in as a Staff user named as Action Officer;", "Click REQUESTS, then For Review (Action Officer)."], "The For Review — Action Officer page lists the tickets assigned to you for technical action and fulfillment."],
    ["Approve as the final Action Officer", ["Open a request;", "Approve the request as the last Action Officer."], "The ticket status becomes Open and the ticket is ready for personnel assignment."],
  ]],
  ["Assigned to me", [
    ["Open Assigned to me", ["Click Assigned to me in the left sidebar."], "The personal work table is displayed with the number of open tasks in the header and the columns TICKET, CLIENT, CLIENT DIVISION, STATUS, and ACTION."],
    ["Verify an assigned ticket", ["Have a ticket assigned to your account;", "Open the Assigned to me page."], "The ticket appears in the table with the status In Progress."],
    ["Work on an assigned ticket", ["Click the option in the ACTION column;", "Open the ticket detail logs;", "Update the internal resolution notes or attach a technical deliverable."], "The notes or the deliverable are saved in the ticket."],
    ["Notify the client after completing the work", ["Complete the work for the ticket;", "Notify the submitting client."], "The client receives the update and can mark the service as complete."],
    ["Verify the empty list", ["Open the Assigned to me page when no ticket is assigned to you."], "The page shows No assigned requests. A request appears here as In Progress once it is assigned to you."],
  ]],
  ["Staff: Service Completion and Feedback", [
    ["Mark the service as complete", ["Open a ticket in My Requests whose work is finished;", "Click Mark service complete."], "The ticket status becomes Resolved."],
    ["Submit the Client Satisfaction Survey", ["Click REQUESTS, then Service Feedback;", "Complete the Client Satisfaction Survey for the service received;", "Submit the feedback."], "The feedback is submitted and the system confirms the feedback submission. When nothing is pending, the page shows No feedback pending."],
    ["Close the ticket", ["After submitting the feedback, click Close ticket."], "The ticket status becomes Closed."],
    ["Reopen a request", ["Open a Resolved ticket;", "Click Reopen request."], "The ticket status becomes Reopened."],
  ]],
];

const modules = "Login, Account Settings, Notifications, Messages, Dashboard, Submit Request, My Requests, For Review queues, Assigned to me, Service Completion and Feedback";
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
  info("Role Tested", "Staff (Client)", "", ""),
] });

const logo = fs.readFileSync(path.join(root, "public/nmp-logo.png"));
const FOOT = "Support Ticketing System – User Acceptance Testing (Staff (Client))";
const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: SZ } } } },
  sections: [{
    properties: { page: { size: { width: H, height: W, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1300, bottom: 900, left: M, right: M, header: 300, footer: 400 } } },
    headers: { default: new Header({ children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: logo, transformation: { width: 48, height: 48 } })] }),
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
