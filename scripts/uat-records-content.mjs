/** Shared content for the STS UAT – Record Admin (Word + PDF generators). Aligned to the current Records portal. */
export const role = "Record Admin";

export const modules =
  "Login, Account Settings, Notifications, Dashboard, Pending Forms, Form Review, Published Forms, My Requests, Submit Request, Activity Logs";

export const sections = [
  ["Access the System", [
    ["Access the Support Ticketing System", ["Open any web browser available in your computer and enter the official STS web address provided by the ICT Section."],
      "You will be redirected to the Log-in Page of the Support Ticketing System, displaying the Welcome Back form with the Username and Password fields, the Show Password (eye) icon, Remember me, and the Sign In button, over the Quality Policy background."],
    ["Verify the Log-in Page branding", ["Check the form and footer of the Log-in Page."],
      "The page shows the National Museum of the Philippines Support Ticketing System branding (NMP logo and Welcome Back heading) and the Privacy Policy and Terms of Use links in the footer."],
  ]],
  ["Login", [
    ["Login to STS", ["Enter your correct credentials (username and password);", "Click the Sign In button."],
      "The Sign In button shows Signing in… while processing. You will be logged in and redirected to the Record Admin dashboard.",
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
    ["Verify the read-only fields", ["Try to edit the Email and Role fields."], "Email and Role are displayed but cannot be edited."],
    ["Update your profile", ["Update the Display name, Division / office, and Designation;", "Click the Save profile button."], "The button shows Saving… and the profile is saved. The message Profile updated is displayed. The updated display name appears in the portal header and in the Activity Logs."],
    ["Save the profile with required fields blank", ["Clear the Display name or the Division / office field;", "Click the Save profile button."], "The profile is not saved. The message Name and division are required is displayed."],
    ["Verify the Password section", ["Check the Password section of the Settings page."], "The page states that the sign-in password is the PAMANA password and cannot be changed in STS. To change it, change the password in PAMANA and then sign in with the new password."],
  ]],
  ["Notifications", [
    ["Open the notification bell", ["Log in as Record Admin;", "Click the notification bell in the header."], "The Notifications dropdown opens, showing the number of items (or You're all caught up). Each item is a form waiting for review, with the form title and Submitted by <Admin name> · <reference number>."],
    ["Open a form from the bell", ["Click a form in the dropdown."], "The dropdown closes and the review page of that form is opened. (A new-form alert received while you are logged in opens the Pending Forms page.)"],
    ["Receive a new form while logged in", ["Have an Admin submit a form to Records while you are logged in."], "A notification pop-up with a sound alert is displayed and the new form is added to the top of the Notifications dropdown. The Pending Forms list and the dashboard counts update without reloading the page."],
    ["View all notifications", ["Click View all at the bottom of the dropdown when items are listed."], "The Pending Forms page is displayed."],
    ["Verify the empty notifications", ["Open the bell when no form is waiting for review."], "The dropdown shows No forms waiting for review."],
  ]],
  ["Record Admin: Dashboard and Navigation", [
    ["Verify the Record Admin dashboard after login", ["Log in as Record Admin."], "The dashboard is displayed with the RECORDS tag, the heading Welcome, <first name>, the current date, the description Review admin-submitted forms and publish approved TA forms for client use., the Pending review and Published forms stats, and the Pending forms and Published forms lists."],
    ["Verify the sidebar menu", ["Expand MAIN, FORMS, REQUESTS, and SYSTEM in the left sidebar."], "MAIN shows Dashboard. FORMS shows Pending Forms and Published Forms. REQUESTS shows My Requests and Submit Request. SYSTEM shows Activity Logs. Settings, Set up MFA, and Logout are at the bottom. Pending Forms shows a count when forms are waiting for review. There is no Messages menu."],
    ["Verify the review button in the banner", ["Have at least one form with status Pending Review;", "Open the dashboard."], "The banner shows the button Review pending (<number>) and the alert <number> form(s) awaiting review (Approve and publish forms, or return them to Admin with remarks.). The button opens the Pending Forms page. When no form is pending, the banner shows the Published forms button instead."],
    ["Open the review queue from the dashboard", ["Click the Pending review stat, or click View all in the Pending forms panel."], "The Pending Forms page is opened."],
    ["Open the published forms from the dashboard", ["Click the Published forms stat, or click View all in the Published forms panel."], "The Published Forms page is opened."],
    ["Verify the Pending forms and Published forms lists", ["Check the Pending forms and Published forms panels."], "Each row shows the form title, the reference number and the Admin who created it, the status badge, and the View file button. Pending forms also show the Review button."],
    ["View a form file from the dashboard", ["Click View file on a form in either panel."], "A read-only preview of the printable form is displayed, titled with the form name and reference number."],
    ["Verify the empty lists", ["Check the Pending forms and Published forms panels when no forms are available."], "The panels show No pending forms. (Forms submitted by Admin for review will appear here.) and No published forms. (Approved forms will appear here once they are live for clients.)"],
    ["Verify that Messages is not available", ["Check the left sidebar and the lower right of the screen;", "Enter the Messages address (/records/messages) in the browser."], "The Records portal has no Messages menu and no chat button. The address redirects you to the Record Admin dashboard."],
    ["Verify the profile menu", ["Click the profile area in the top-right header."], "The user name and role details are displayed."],
  ]],
  ["Record Admin: Pending Forms", [
    ["Open the Pending Forms", ["Click FORMS, then Pending Forms, in the left sidebar."], "The Pending Forms page is displayed with the description Forms submitted by Admin with status Pending Review — approve or disapprove before publishing., the Refresh button, the Search form… box, and the table panel showing the number of pending forms with the columns Form, Submitted by, Submitted, Ref, and Action."],
    ["Refresh the list", ["Click the Refresh button in the upper right corner."], "The button shows Refreshing… while loading. The table is updated with the latest submitted forms."],
    ["Search the pending forms", ["Type a form title or reference number in the Search form… box."], "The list is filtered to match what you typed."],
    ["View a pending form file", ["Click View file on a form."], "A read-only preview of the printable form template is displayed, titled with the form name and reference number."],
    ["Use the preview controls", ["Click the zoom out and zoom in buttons;", "Click the reset button;", "Scroll through the preview."], "The document zoom is changed. Reset returns the view to its default, and all pages of the form can be checked."],
    ["Open the review page", ["Click Review on a form."], "The review page of the form is opened."],
    ["Verify the empty list", ["Open the Pending Forms page when no form is waiting for review."], "The page shows No pending forms. Forms sent to Records by Admin appear here."],
  ]],
  ["Record Admin: Form Review", [
    ["Verify the review page", ["Open a form from Pending Forms using Review."], "The page shows a Back to pending forms link, the form title with its reference number, version, and Submitted by <Admin name>, and the status badge Pending Review. The Form template panel shows the uploaded printable form (Uploaded by Admin. Zoom and scroll to review. View only.), and the Recommendation panel shows the choices Approve & publish and Disapprove."],
    ["Review the form template", ["In the Form template panel, zoom and scroll through the printable form."], "All pages of the form template are displayed, with the field placements and any supporting document, in view-only mode."],
    ["Disapprove a form without remarks", ["Select Disapprove;", "Leave the remarks field blank."], "The Remarks field (placeholder: Remarks (e.g. Please add required fields)) is shown. The Submit recommendation button stays disabled, because remarks are required to disapprove."],
    ["Disapprove a form with remarks", ["Select Disapprove;", "Enter your remarks;", "Click Submit recommendation."], "The button shows Submitting…, then the message Form returned to admin is displayed together with the notice Recommendation submitted. The form status changes to Disapproved and the form is returned to the Admin with your remarks. The action is recorded in the Activity Logs."],
    ["Approve and publish a form", ["Select Approve & publish;", "Click Submit recommendation."], "The button shows Submitting…, then the message Form published is displayed together with the notice Recommendation submitted. The form status changes to Published. It is removed from Pending Forms, appears in Published Forms, and becomes available under Submit Request. The action is recorded in the Activity Logs."],
    ["Verify that a decision cannot be repeated", ["Submit a recommendation;", "Open the same form again."], "The page shows Review already completed (This form was already approved and published. or This form was already returned to Admin for revision.). The Recommendation panel is no longer shown."],
    ["Verify the back link", ["Click Back to pending forms."], "The Pending Forms page is opened, without the form that was just reviewed."],
    ["Open a form that does not exist", ["Open a review page of a form that was removed or that you cannot access."], "The page shows Form not found with the link Back to pending forms."],
  ]],
  ["Record Admin: Published Forms", [
    ["Open the Published Forms", ["Click FORMS, then Published Forms, in the left sidebar."], "The Published Forms page is displayed with the description Live TA forms available for clients to submit requests., and the table panel showing the number of published forms with the columns Form, Ref, Effectivity, Version, and Action."],
    ["Verify a newly published form", ["Approve and publish a form from Pending Forms;", "Open the Published Forms page."], "The approved form appears in the table with its title, reference number, date effectivity, and version."],
    ["View a published form file", ["Click View file on a form."], "A read-only preview of the published printable form is displayed, with its field placements."],
    ["Verify the form for clients", ["Log in as a client (Staff) account;", "Open Submit Request."], "The published form is available in the form list."],
    ["Verify the empty list", ["Open the Published Forms page when no forms are published."], "The page shows No published forms. Approved forms from Pending Forms will appear here once published."],
  ]],
  ["Record Admin: My Requests and Submit Request", [
    ["Open My Requests", ["Click REQUESTS, then My Requests, in the left sidebar."], "The My Requests page lists your own requests (separate from the forms you review), with the New request button and the columns Ticket, Form, Status, Assigned to, Submitted, and Action."],
    ["Verify the empty list", ["Open My Requests when you have not submitted any request."], "The page shows No personal requests yet. Submit a TA request for yourself — it will appear here., with the Submit request button."],
    ["Open Submit Request", ["Click REQUESTS, then Submit Request, in the left sidebar (or click New request)."], "The Submit Request page is displayed with the text Submitting as <your name>. This request will appear in your list only. and the Choose a form panel. When no form is published, it shows No forms available."],
    ["Submit a request as Record Admin", ["Select a published form in Choose a form;", "Review the TA form and the auto-filled requestor details;", "Complete the required fields;", "Click Submit request."], "The message Request submitted is displayed and the request appears in My Requests."],
    ["Submit a request with no fields filled", ["Select a published form;", "Leave all fields blank;", "Click Submit request."], "The request is not submitted and the message Fill in at least one field before submitting. is displayed."],
    ["Open a request", ["Open My Requests;", "Click the option in the Action column of a request."], "The request details are displayed with the ticket number, the Assigned personnel, and the Complete service and Close request actions once the work is done."],
  ]],
  ["Record Admin: Activity Logs", [
    ["Open the Activity Logs", ["Click SYSTEM, then Activity Logs, in the left sidebar."], "The Activity Logs page is displayed with the description Audit trail of form reviews, publications, and other Records actions., and the table panel showing the number of recent events with the columns When, Actor, Action, and Summary."],
    ["Verify the audit trail entries", ["Approve or disapprove a form;", "Open the Activity Logs page."], "A new entry is displayed with the date and time, the user who performed the action (Actor), the action, and the summary of what was done."],
    ["Verify the empty list", ["Open the Activity Logs page when no actions are recorded."], "The page shows No activity yet. Actions will be logged here as they occur."],
  ]],
];
