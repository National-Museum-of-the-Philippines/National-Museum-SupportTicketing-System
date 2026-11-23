/** Shared content for the STS UAT – Super Admin (Word + PDF generators). Aligned to the current Super Admin portal. */
import { sections as base } from "./uat-records-content.mjs";

export const role = "Super Admin";
export const modules =
  "Login, Account Settings, Notifications, Dashboard, Reports and Analytics, All Tickets, Portal Access, My Requests and Submit Request, Users, Roles and Permissions, System Management, End-to-End Workflow";

const [access, login, mfa, settings] = base;
const loginTests = login[1].map((t, i) => i === 0
  ? [t[0], t[1], "The Sign In button shows Signing in… while processing. You will be logged in and redirected to the Super Admin dashboard.", t[3]]
  : t);
const settingsTests = settings[1].map((t, i) => i === 1
  ? ["Verify the read-only fields", ["Try to edit the Email and Role fields."], "Email and Role are displayed but cannot be edited. Role shows Super Admin."] : t);

export const sections = [
  access,
  ["Login", loginTests],
  mfa,
  ["Settings and Account Profile", [
    ["Open the Settings page", ["Click Settings at the bottom of the left sidebar, or click ACCOUNT, then My Profile."], settings[1][0][2]],
    ...settingsTests.slice(1),
  ]],
  ["Notifications", [
    ["Open the notification bell", ["Log in as Super Admin;", "Click the notification bell in the header."], "The Notifications dropdown opens and shows No system alerts. The Super Admin bell has no per-item alerts; system-wide queues are on the System Notifications page."],
    ["Verify that Messages is not available", ["Check the left sidebar and the lower right of the screen."], "The Super Admin portal has no Messages menu and no chat button. (Messages are available in the Admin and Staff portals, which you can open without signing out.)"],
  ]],
  ["Super Admin: Dashboard", [
    ["Verify the Super Admin dashboard after login", ["Log in as Super Admin."], "The Dashboard is displayed with a banner showing the date and Super Admin, the greeting Good morning / afternoon / evening, <your name>, the text Here is how the Support Ticketing System is doing across all sections today., the Open Reports & Analytics button, and the All requests and Completed figures (with the number of sections and the completion percentage)."],
    ["Open Reports from the dashboard", ["Click Open Reports & Analytics in the banner."], "The Reports & Analytics page is opened."],
    ["Verify the alert cards", ["Check the three cards below the banner."], "The cards show Overdue tickets (across <n> sections, with Review), Forms to review (waiting for Records, with Open), and Reopened (needs another look, with View)."],
    ["Open the tickets and forms from the alert cards", ["Click Review on Overdue tickets;", "Go back and click Open on Forms to review;", "Go back and click View on Reopened."], "Review opens All Tickets on the Overdue tab. Open opens Form Management. View opens All Tickets on the Reopened tab."],
    ["Verify the status strip", ["Check the status strip."], "The strip shows the counts of Pending, In progress, Resolved, Closed, and Rejected tickets."],
    ["Search and filter Requests by section", ["In Requests by section, type in Search section…;", "Change Sort (Most requests, Highest % done, Most overdue);", "Change the status filter (All statuses, Has completed, Has in progress, Has pending);", "Use the page buttons below the list."], "The list shows the matching sections, each with a bar of Completed, In progress, and Pending requests and a legend. Five sections are shown per page. When nothing matches, it shows No sections match."],
    ["Verify the Incoming tickets", ["Check the Incoming tickets panel (Newest first);", "Click the All, New, Assigned, and Overdue tabs."], "Each ticket shows the form title, the ticket number and section, the status badge (or Overdue), and how long ago it was submitted. The tabs filter the list and show a count. When nothing is in the view, it shows No tickets in this view."],
    ["Verify Needs attention", ["Check the Needs attention panel."], "The panel shows the top 5 sections by overdue rate, each with its number of overdue tickets. When none is overdue, it shows Nothing overdue."],
    ["Verify the Recent activity", ["Check the Recent activity panel."], "The latest actions in the system are listed with the action summary, the user, and the time. When there is none, the panel shows No activity yet."],
    ["Verify the dashboard refresh", ["Keep the dashboard open while a ticket changes status."], "The dashboard figures refresh automatically about every minute."],
    ["Verify the profile menu", ["Click the profile area in the top-right header."], "The user name and role details are displayed."],
  ]],
  ["Super Admin: Reports and Analytics", [
    ["Open Reports & Analytics", ["Click MAIN, then Reports & Analytics, in the left sidebar."], "The page is displayed with the heading Reports & Analytics, the Period selector, the Export button, and the tabs Overview and Divisions with the Division requests… selector."],
    ["Verify the Overview tab", ["Open the Overview tab."], "The Requests per month column chart (Closed requests across all divisions) is shown, followed by Client feedback comments (<number>) and the Average rating out of 5 when feedback exists."],
    ["Change the period", ["Select the Period: Last 7 days, Last 30 days, Last 6 weeks, Last 3 months, or All time."], "The page text Four views of the same <n> requests… and the feedback list are updated for the selected period."],
    ["Verify the Divisions tab", ["Open the Divisions tab;", "Type in Search division…;", "Click Open › on a division."], "Divisions with completed requests are shown as cards with their completed count. When there is none, it shows No completed requests. Open › opens the requests of that division."],
    ["Open the requests of a division", ["Select a division in Division requests…;", "Search a ticket, client, or request and filter by status."], "The tab shows All requests of this division with the columns Ticket, Request type, Client, Status, and Submitted. When nothing matches, it shows No requests found."],
    ["Verify the Client feedback comments", ["Submit feedback on a completed ticket;", "Open Reports & Analytics, Overview tab."], "The ticket appears in Client feedback comments with its ticket number. View request opens the ticket."],
    ["Verify the empty feedback", ["Open the Overview tab when no feedback is submitted."], "The list shows No feedback yet. Client comments appear here after they confirm feedback on a completed service."],
    ["Export the requests", ["Click the Export button."], "A CSV file named requests-<date>.csv is downloaded with the Ticket, Request type, Client, Division, Status, Submitted, Updated, and Rating columns. The button is disabled when there are no requests."],
  ]],
  ["Super Admin: All Tickets", [
    ["Open All Tickets", ["Click TICKETS, then All Tickets, in the left sidebar."], "The page is displayed with the text Every ticket from every section. Clients send them; you monitor., the Export button, the tabs All, New today, Unassigned, Overdue, Reopened, and Closed (each with a count), the search box, the All sections and All statuses filters, and the table with the columns Ticket, Form / Request, Section, Requested by, Staff in charge, Status, and Submitted."],
    ["Search the tickets", ["Type a ticket number, client name, or form in Search ticket no., client or form…."], "The table shows only the matching tickets."],
    ["Filter the tickets", ["Select a section in All sections;", "Select a status in All statuses;", "Click each tab."], "The table shows only the tickets that match. Unassigned tickets show the Unassigned badge in Staff in charge. Late tickets show <n> d late."],
    ["Move between pages", ["Click the next page and previous page buttons below the table (eight tickets per page)."], "The next and previous pages are displayed."],
    ["Verify the empty table", ["Apply a filter that matches no ticket."], "The table shows No tickets match. Try a different tab or clear a filter."],
    ["Export the tickets", ["Click the Export button."], "A CSV file of the listed tickets is downloaded. The button is disabled when the list is empty."],
  ]],
  ["Super Admin: Portal Access", [
    ["Verify the sidebar menu", ["Check the left sidebar."], "The sidebar shows MAIN (Dashboard, Reports & Analytics), TICKETS (All Tickets), REQUESTS (My Requests, Submit Request), PORTALS / ACCESS (Admin Portal, Records Portal, Staff/Client Portal), USER & ACCESS MANAGEMENT (Users, Roles, Permissions), SYSTEM MANAGEMENT (Form Management, Activity Logs / Audit Logs, Error Monitoring, System Notifications), and ACCOUNT (My Profile), with Settings, Set up MFA, and Logout at the bottom."],
    ["Open the Admin Portal", ["Click Admin Portal in the sidebar."], "The Admin portal is opened without signing out."],
    ["Open the Records Portal", ["Click Records Portal."], "The Records portal is opened without signing out."],
    ["Open the Staff / Client Portal", ["Click Staff/Client Portal."], "The Staff/Client portal is opened without signing out."],
    ["Switch between portals", ["While inside another portal, check the SWITCH PORTAL section of the sidebar;", "Click Super Admin, Admin, Records, or Staff."], "SWITCH PORTAL shows Super Admin, Admin, Records, and Staff. You move to the selected portal without signing out."],
    ["Logout as Super Admin", ["Click Logout."], "The sessions used across all portals are cleared and you are returned to the Log-in Page."],
  ]],
  ["Super Admin: My Requests and Submit Request", [
    ["Open My Requests", ["Click REQUESTS, then My Requests, in the left sidebar."], "The My Requests page lists your own requests with the New request button. When there is none, it shows No personal requests yet."],
    ["Submit a personal request as Super Admin", ["Click REQUESTS, then Submit Request;", "Select a published form and complete the fields;", "Click Submit request."], "The message Request submitted is displayed. The request is created using the same steps as a Staff user and appears under My Requests."],
  ]],
  ["Super Admin: Users, Roles, and Permissions", [
    ["Open the Users page", ["Click USER & ACCESS MANAGEMENT, then Users."], "The Users page is displayed with the tabs Users, Roles, and Permissions, and the cards Active employees, With roles, and Needs role assignment."],
    ["Search and filter the employees", ["Type a name, username, email, or ID in Search name, username, email, ID…;", "Filter by role (All roles);", "Select All access, With roles, or Needs assignment."], "The Employee access table shows only the matching employees with the columns Employee, Account, Assigned roles, and Action."],
    ["Search with no result", ["Search for an employee that does not exist."], "The table shows No employees found. Try a different search or filter."],
    ["Assign roles to an employee", ["Click Assign roles on an employee;", "Tick the roles (Super Admin, Admin, Record Management, or Staff);", "Click Save roles."], "The button shows Saving… and the message Roles updated is displayed. The roles are shown under Assigned roles of the employee."],
    ["Manage the roles of an employee", ["Click Manage roles on an employee;", "Change the ticked roles;", "Click Save roles."], "The updated roles are saved."],
    ["Cancel the role assignment", ["Open the Assign roles or Manage roles window;", "Change the roles;", "Click Cancel."], "The window is closed and no change is saved."],
    ["Reset the MFA of an employee", ["Open Manage roles on an employee who has MFA enabled (the window shows Multi-factor authentication is enabled.);", "Click Reset MFA and confirm."], "The message MFA reset — the employee can sign in with their password and enroll again is displayed. The employee can then sign in with the password only and set up MFA again."],
    ["Move between pages", ["Click Next and Prev below the employee table."], "The next and previous pages of employees are displayed."],
    ["Verify the effect of a role", ["Assign a role to a user;", "Log in as that user."], "The user can only open the portals and functions that match the assigned role."],
    ["Open the Roles page", ["Click Roles."], "The Roles page lists the system roles with the cards Roles, Custom roles, and Role assignments, and the columns Role, Permissions, Users, and Action. The system roles are marked System role and cannot be deleted."],
    ["Create a role", ["Click New role;", "Enter the Name (for example form_reviewer) and an optional Description;", "Click Create role."], "The button shows Creating…, the message Role created is displayed, and the new role is added to the list."],
    ["Manage a role", ["Click Manage on a role;", "Update the description;", "Tick the permissions, using Filter permissions… to find a capability;", "Click Save."], "The button shows Saving… and the message Role permissions saved is displayed."],
    ["Delete a custom role", ["Click Delete on a custom role;", "Confirm the deletion."], "The system asks for confirmation. After you confirm, the message Role deleted is displayed and the role is removed."],
    ["Open the Permissions page", ["Click Permissions;", "Type a permission in Search permissions…."], "The Permission catalog lists the Permission, Key, and Roles using each permission, grouped by category, with the cards Total permissions, Ticketing permissions, and Categories. Only the matching permissions are shown; when there is none, it shows No permissions found. Permissions are assigned from the Roles page."],
    ["Verify that RBAC is only in the Super Admin portal", ["Log in as Admin and check the sidebar."], "Users, Roles, and Permissions are not available in the Admin sidebar."],
  ]],
  ["Super Admin: System Management", [
    ["Open Form Management", ["Click SYSTEM MANAGEMENT, then Form Management."], "The My Forms Analytics page is displayed with the summary cards Total Requests, Total Divisions / Sections, Most Requested Service, and Requests This Month, the Requests by Division / Section chart, Quick Insights, the Monthly Request Trend, and the My Forms list with the + New Form button."],
    ["Verify the form cards", ["Check the cards under My Forms."], "Each card shows the form title, reference number, status badge (Draft, Pending Review, Published, or Disapproved), the number of requests, and the last submission date. A disapproved form shows the Records remarks."],
    ["Send or resend a form to Records", ["On a Draft form click Send to Records, or on a Disapproved form click Resubmit."], "The message \"<title>\" sent to Records is displayed and the form status changes to Pending Review."],
    ["View a form and its chart", ["Click View on a form that is already sent;", "Click Chart on a form card."], "View shows the form preview. Chart shows or hides Requests (12 mo) for that form."],
    ["Open the Activity Logs / Audit Logs", ["Click Activity Logs / Audit Logs."], "The page shows System-wide audit trail of significant actions across portals. Each event shows the action summary, the user, and the time. When there is no activity, the page shows No activity yet. Actions across the system will appear here."],
    ["Open Error Monitoring", ["Click Error Monitoring."], "The page shows the cards Open errors, Open warnings, Seen in last 24h, and Browser-side, and the list of server exceptions, browser errors, and console failures with the columns Last seen, Level, Error, Where, User, Count, and Actions. Repeats of the same error are grouped until resolved."],
    ["Filter the errors", ["Select a Status (Open, Resolved, or All);", "Select a Level (Any level, Errors, Warnings) and a Source (Any source, Server, Browser, Console);", "Type a search text and press Enter."], "The list shows only the errors that match. When nothing matches, it shows Nothing matches these filters. Try a different status, level, source, or search term."],
    ["View the error details", ["Click an error row."], "The Error details window shows the Exception / kind, Location, Request, User, IP address, Browser, Resolved, Fingerprint, and the Stack trace."],
    ["Resolve, reopen, and delete an error", ["Click Mark as resolved on an open error;", "Click Reopen on a resolved error;", "Click Delete on an error and confirm."], "The messages Marked as resolved, Reopened, and Entry deleted are displayed. The error moves to Resolved, back to Open, and the deleted error is removed from the list."],
    ["Resolve all and delete resolved errors", ["Click Refresh;", "Click Resolve all and confirm;", "Click Delete resolved and confirm."], "The list is refreshed. All open entries are marked as resolved, then all resolved entries are permanently deleted."],
    ["Open System Notifications", ["Click System Notifications."], "The page shows the notice How notifications work, Pending form reviews (with Open Records · Pending Forms →), Pending client approvals (with Open Admin · Approvals →), and the Audit trail (with Open Activity Logs →). When there is nothing to show, the audit trail shows No alerts. Recent system activity will show here."],
  ]],
  ["End-to-End Workflow", [
    ["Create and submit a form to Records", ["Log in as Admin;", "Create a form in the Form Builder and complete all six steps;", "Click Submit to Records."], "The form status is Pending Review."],
    ["Approve and publish the form", ["Log in as Record Admin;", "Open Pending Forms, then Review;", "Select Approve & publish and click Submit recommendation."], "The form status is Published and the form appears in Published Forms."],
    ["Submit a request", ["Log in as Staff;", "Open Submit Request and select the published form;", "Complete the form and click Submit request."], "The ticket is created and appears in My Requests. The requestor details are filled in from PAMANA."],
    ["Complete the client approval steps", ["Approve the request as the Recommending Officer;", "Approve the request as the Immediate Supervisor."], "The ticket status moves from For Client Approval to For Process Owner."],
    ["Complete the Action Officer approvals", ["Approve the request as each Action Officer in the configured order."], "After the last Action Officer approval, the ticket status becomes Open."],
    ["Assign personnel", ["Log in as Admin (the last Action Officer);", "Open Request Management and assign personnel to the ticket."], "The ticket status becomes In Progress and the ticket appears in Assigned to me of the assigned personnel."],
    ["Complete the service", ["Log in as the assigned personnel and complete the work;", "Notify the client through the Request messages."], "The client is informed that the work is done."],
    ["Complete and close the ticket", ["Log in as the requestor;", "Click Mark service complete;", "Submit the Client Satisfaction Survey;", "Click Close ticket."], "The ticket status moves from Resolved to Closed."],
    ["Verify the audit trail and reports", ["Log in as Super Admin;", "Open Activity Logs / Audit Logs;", "Open Reports & Analytics."], "The Activity Logs record the submission, review, approval, assignment, completion, and closure of the form and ticket. The reports show the closed ticket and the client feedback."],
    ["Reopen a request", ["Log in as the requestor;", "Open a Resolved ticket and click Reopen request."], "The ticket status becomes Reopened and it is counted in the Reopened card of the Super Admin dashboard."],
  ]],
];
