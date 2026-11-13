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
    ["Open the notification bell", ["Log in as Staff;", "Click the notification bell in the header."], "The Notifications dropdown opens, showing the number of items (or You're all caught up) and the actionable updates on your requests, each with the ticket number, a short status message, and the time."],
    ["Open an update from the bell", ["Click a ticket update in the dropdown."], "The dropdown closes and the related request opens. A message update opens the chat window instead."],
    ["Verify the empty notifications", ["Open the bell when you have no updates."], "The dropdown shows No updates on your requests."],
    ["View all notifications", ["Click View all at the bottom of the dropdown."], "The My Requests page is displayed."],
  ]],
  ["Messages", [
    ["Open the Messages window", ["Click MAIN, then Messages, in the left sidebar (or click the chat button at the lower right of the screen)."], "The floating Messages window opens over the page with the + New button, the Search chats box, and your chats grouped under Requests and Direct messages. The unread count appears on the chat button and the sidebar."],
    ["Verify the empty chat list", ["Open the Messages window when you have no chats."], "The window shows No chats yet. Start one with New."],
    ["Search your chats", ["Type a name or request in the Search chats box."], "The list is filtered to match. When nothing matches, the window shows No chats match your search."],
    ["Open the New message window", ["Click the New button."], "The New message window is displayed with the note Message or poke anyone: admin, records, or client., the search box (Search by name, email, or division…), and the Admin and Clients groups, each user with a Poke button."],
    ["Search for a user", ["In the New message window, type a name, email, or division in the search box."], "The list is filtered to match what you typed. When there is no match, it shows No people found."],
    ["Start a direct conversation", ["Click the name row of a user."], "A private direct chat with that user is created and opened. When there are no messages yet, it shows No messages yet and Send the first message below."],
    ["Send a message", ["Type a message in the Message <name>… field;", "Click the Send button or press Enter."], "The message appears in the thread instantly and is delivered in real time to the other person."],
    ["Mention a user", ["Click the @ button or type @ in the message field;", "Select a person from the list;", "Send the message."], "The selected person is tagged in the message."],
    ["Poke a user", ["Click the Poke button beside a user in the New message window, or the Poke button in the chat header."], "The message Poked <name>! is displayed. The user receives an instant alert in the notification bell without a full conversation."],
    ["Open the request chat", ["Open a ticket from My Requests;", "Click the Request messages button."], "The chat for that request opens with the status, the form title, the View ticket button, and the Request details panel (Form, Division, Submitted, Assigned to). The message field shows Message about this request…."],
    ["Open the request from the chat", ["In a request chat, click View ticket."], "The chat closes and the ticket detail page is displayed."],
    ["Receive a new message", ["Have another user send you a message while you are on another page."], "The unread badge on the chat button updates. When you are scrolled up in a thread, the New messages button appears and scrolls you to the latest message when clicked."],
    ["Close the Messages window", ["Click the X button, or click outside the window."], "The window closes and the chat button is shown again."],
  ]],
  ["Staff: Dashboard and Navigation", [
    ["Verify the Staff dashboard after login", ["Log in as Staff."], "The dashboard is displayed with the banner (Client tag, Welcome back with your first name, the date and your division), the New request button, the Active requests, Pending approval, and Completed cards, and the Recent requests panel."],
    ["Verify the sidebar menu", ["Expand MAIN and REQUESTS in the left sidebar."], "MAIN shows Dashboard, Assigned to me, and Messages. REQUESTS shows For Review (Recommending), For Review (Supervisor), For Review (Action Officer), Submit Request, My Requests, and Service Feedback. Settings, Set up MFA, and Logout are at the bottom. Menu items show a count when something needs your action."],
    ["Verify the dashboard alerts", ["Have a request that is assigned to you, awaiting your feedback, ready to mark complete, or rejected;", "Open the dashboard."], "The matching alert is shown: You have assigned requests, Submit feedback, Mark service complete, or Request rejected, with a button that opens the related page."],
    ["Verify the Assigned to me panel", ["Have a request assigned to you;", "Open the dashboard."], "The Assigned to me panel lists up to six requests with their status and an Open button, and a View all button."],
    ["Open the queues from the metric cards", ["Click View all in the Active requests, Pending approval, and Completed cards."], "Each card opens the My Requests page."],
    ["Open a new request from the dashboard", ["Click the New request button."], "The Submit Request page is displayed so you can start a new request."],
    ["Open a request from Recent requests", ["Click View beside a request in the Recent requests panel."], "The request detail page is displayed. A request that needs feedback shows a Feedback button instead."],
    ["Verify the empty Recent requests panel", ["Check the Recent requests panel when you have no requests."], "The panel shows No requests available. with the Submit a request button."],
  ]],
  ["Staff: Submit Request", [
    ["Open the Submit Request page", ["Click REQUESTS, then Submit Request, in the left sidebar."], "The Submit Request page is displayed, showing that you are submitting as your own name and that the request appears in your list only, with the Choose a form panel and the Published form dropdown."],
    ["Verify the form list", ["Click the Published form dropdown (Select a form…)."], "Only the forms with the status Published are listed."],
    ["Select a form", ["Select a published form."], "The form fields are loaded. When the form has a printable template, the Review the TA form notice shows the View form file button."],
    ["Verify the PAMANA autofill", ["Select a published form;", "Check Your requestor details (auto-filled)."], "Division/Section, Designation, First name, Middle name, Last name, and Email are filled in automatically from your PAMANA employee record."],
    ["Verify an account without a PAMANA record", ["Log in with an account that is not linked to a PAMANA staff record;", "Select a published form."], "The requestor details show that no employee record was found for this login, and they are not filled in automatically."],
    ["Complete the form", ["Fill in the remaining required fields;", "Upload the supporting attachments if the form requires them (PDF files only, maximum 25 MB)."], "The entered information is accepted and File uploaded is shown. A file that is not a PDF is rejected with Only PDF files are allowed. A file over the limit is rejected with a file-too-large message."],
    ["Submit with a required field empty", ["Leave a required field blank;", "Click the Submit request button."], "The request is not submitted and the missing required field is indicated."],
    ["Preview the form before submitting", ["Click the View form file button."], "The form file preview opens and shows your answers, including the PAMANA fields, at the positions mapped by the Admin on the printable layout."],
    ["Submit the request", ["Click the Submit request button."], "The message Request submitted is displayed with the ticket number. The ticket appears in My Requests with the first step of the configured workflow: For Client Approval when the Recommending Officer or Immediate Supervisor is enabled, otherwise For Process Owner."],
    ["Verify the empty form list", ["Open the Submit Request page when no forms are published."], "The page shows No forms available. Published TA forms appear once Records approves them."],
  ]],
  ["Staff: My Requests", [
    ["Open My Requests", ["Click REQUESTS, then My Requests, in the left sidebar."], "The page lists the tickets filed under your account with the columns Ticket, Form, Status, Assigned to, Submitted, and Action, with the New request button."],
    ["Open a ticket", ["Click a ticket in the list."], "The ticket detail page is displayed with the ticket number, the status, the Request messages button, the submitted request details, and the Assigned personnel panel. The Complete service or Close request panel appears when it applies."],
    ["Verify the ticket status", ["Check the status of a ticket while it moves through the workflow."], "The status shows the current step of the workflow, such as For Client Approval, For Process Owner, Open, In Progress, Resolved, Closed, Rejected, or Reopened."],
    ["Verify the assigned personnel", ["Open a ticket before and after personnel are assigned."], "Before assignment, the panel states that an admin will assign personnel after approval. After assignment, it shows the assigned personnel."],
    ["Go back to My Requests", ["Click Back to my requests."], "The My Requests list is displayed."],
    ["Start a new request from My Requests", ["Click the New request button."], "The Submit Request page is displayed."],
    ["Verify the empty list", ["Open My Requests when you have no requests."], "The page shows No requests available. with the Submit request button."],
  ]],
  ["Staff: For Review Queues", [
    ["Open For Review (Recommending)", ["Log in as a Staff user named as Recommending Officer;", "Click REQUESTS, then For Review (Recommending)."], "The For Review — Recommending Officer page lists the requests of your section with the columns Ticket, Client, Division, Status, and Action. When there are none, it shows Nothing to review."],
    ["View the submitted file", ["Click View file beside a request."], "The submitted form file of the request is displayed."],
    ["Approve as Recommending Officer", ["Click Approve beside a request."], "The message Endorsed for supervisor review is displayed. When the Immediate Supervisor stage is enabled, the request appears in For Review (Supervisor)."],
    ["Reject a request", ["Click Reject beside a request;", "Enter the reason in the Reject request panel and confirm."], "The message Request rejected is displayed and the request leaves the queue. The requester sees the Rejected status."],
    ["Open For Review (Supervisor)", ["Log in as a Staff user named as Immediate Supervisor;", "Click REQUESTS, then For Review (Supervisor)."], "The For Review — Immediate Supervisor page lists the endorsed requests of your section waiting for your review."],
    ["Approve as Immediate Supervisor", ["Click Approve beside a request."], "The message Approved for Action Officers is displayed. The request moves to the Action Officer steps and its status shows For Process Owner."],
    ["Open For Review (Action Officer)", ["Log in as a Staff user named as Action Officer;", "Click REQUESTS, then For Review (Action Officer)."], "The For Review — Action Officer page lists the requests waiting for your approval at your Action Officer step."],
    ["Approve as the final Action Officer", ["Click Approve beside a request as the last Action Officer."], "The message Approved — ready for task assignment is displayed and the ticket is ready for personnel assignment by Request Management."],
  ]],
  ["Assigned to me", [
    ["Open Assigned to me", ["Click Assigned to me in the left sidebar."], "The page lists the requests that an admin assigned to you, with the number of active assignments in the header and the columns Ticket, Client, Status, and Action."],
    ["Verify an assigned ticket", ["Have a ticket assigned to your account;", "Open the Assigned to me page."], "The ticket appears in the table with the status In Progress, and a notification and a request chat are available for it."],
    ["Open an assigned ticket", ["Click Open beside a ticket."], "The ticket detail page is displayed with Back to my assignments and the note You are assigned to work on this request."],
    ["Message the requester about the ticket", ["In the assigned ticket, click Request messages;", "Send a message."], "The request chat opens and the message is delivered to the requester."],
    ["Verify the empty list", ["Open the Assigned to me page when no ticket is assigned to you."], "The page shows No assigned requests. A request appears here once an admin assigns it to you."],
  ]],
  ["Staff: Service Completion and Feedback", [
    ["Mark the service as complete", ["Open an In Progress ticket in My Requests whose work is finished;", "Click Mark service complete."], "The message Service marked complete is displayed, the ticket status becomes Resolved, and the Client Satisfaction Survey opens in a new tab."],
    ["Submit the Client Satisfaction Survey", ["Click Open Client Satisfaction Survey (step 1) and complete the survey for the service received;", "Return to the ticket and optionally enter Notes for admin;", "Click I've submitted feedback (step 2)."], "The message Feedback recorded — you can now close this request is displayed and the Close request panel appears."],
    ["Verify the Service Feedback page", ["Click REQUESTS, then Service Feedback."], "The page lists the requests under Awaiting feedback, and under Ready to close the requests with confirmed feedback, each with a Close request button. When nothing is pending, it shows No feedback pending."],
    ["Close the ticket", ["Click Close ticket in the Close request panel."], "The message Ticket closed is displayed and the ticket status becomes Closed. The page shows Request closed and Thank you for your feedback."],
    ["Reopen a request", ["Open a ticket whose feedback is submitted;", "Click Reopen request."], "The message Request reopened is displayed and the ticket status becomes Reopened."],
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
