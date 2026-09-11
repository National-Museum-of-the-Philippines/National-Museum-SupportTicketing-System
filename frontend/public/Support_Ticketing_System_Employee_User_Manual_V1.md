# NATIONAL MUSEUM OF THE PHILIPPINES

# Support Ticketing System

## Employee User Manual

**Version 1.0**  
**September 2026**

---

## Table of Contents

1. Introduction  
   1.1 Overview  
   1.2 Objectives  
   1.3 User’s Role, Access and Permission  
2. General Information  
   2.1 Objectives  
   2.2 System Features  
   2.3 System Users and Their Descriptions  
3. Getting Started  
   3.1 Log-in / Sign In  
   3.2 Dashboard  
   3.3 System Navigation  
4. Super Admin Portal  
   4.1 Dashboard  
   4.2 Portal Access / Switch Portal  
   4.3 Users, Roles, and Permissions (RBAC)  
   4.4 System Management  
5. Admin Portal  
   5.1 Form Builder  
   5.2 My Forms  
   5.3 Approvals  
   5.4 Request Management  
   5.5 My Assignments  
   5.6 My Requests / Submit TA Request  
   5.7 Reports  
6. Records Portal  
   6.1 Pending Forms  
   6.2 Published Forms  
   6.3 Activity Logs  
7. Client Portal (Staff)  
   7.1 Submit Request  
   7.2 My Requests  
   7.3 Service Feedback  
8. Shared Features  
   8.1 Messages  
   8.2 Notifications  
   8.3 Settings  
9. Status Reference  
   9.1 Form Statuses  
   9.2 Ticket Statuses  
   9.3 End-to-End Workflow Summary  
10. Frequently Asked Questions  

---

## 1. Introduction

### 1.1 Overview

The **Support Ticketing System** is a centralized platform designed to streamline the creation, review, submission, approval, assignment, and completion of **technical assistance (TA) requests** within the National Museum of the Philippines (NMP). It provides Super Admin, Admin, Records, and Staff users with the tools needed to build and publish TA forms, review form templates, submit TA requests with requestor details auto-filled from **PAMANA** (HR employee records), approve and assign work to authorized personnel, and track service completion, feedback, and closure.

This manual serves as a guide for authorized employees in using the Support Ticketing System. It covers logging in and navigating each portal (**Super Admin**, **Admin**, **Records**, and **Client / Staff**), managing forms and requests, messaging, notifications, and account settings.

The Support Ticketing System aims to improve efficiency, accountability, and transparency in technical assistance handling by reducing manual paperwork, ensuring requestor details are accurate through PAMANA integration, and providing a clear audit trail for every request processed within the system. This manual is intended for authorized NMP personnel responsible for operating or using the platform according to their assigned role.

**Important branding note:** **PAMANA** is used only to identify and auto-fill the requestor’s employee profile (division/section, name, email, designation). The product name of this application is **Support Ticketing System**.

### 1.2 Objectives

The Support Ticketing System of the National Museum of the Philippines (NMP) aims to provide a centralized and efficient platform for monitoring, managing, and tracking technical assistance requests within the organization. The system will improve request visibility, accountability, processing efficiency, and timely action by authorized personnel and offices.

The Support Ticketing System aims to make the creation, review, submission, approval, assignment, and closure of technical assistance requests easier and more organized. It helps users quickly check the status of TA forms and tickets, reduce delays, and keep a clear record of transactions. The system also provides dashboards, notifications, messaging, and reports to help offices monitor pending and completed requests.

### 1.3 User’s Role, Access and Permission

**1.3.1 Super Admin** has the highest level of system access. Super Admin can open every portal (Admin, Records, and Staff/Client) with one account, manage Users / Roles / Permissions (RBAC), view system-wide dashboards and activity logs, and switch portals from the sidebar.

**1.3.2 Admin** is responsible for Form Builder and My Forms, approving client TA requests, assigning personnel (from the form owner’s division), monitoring Request Management and My Assignments, submitting personal TA requests when needed, and viewing Reports. Admin covers Section Head (ODG Section and Regional Component Museum) and Division Head (All except ODG).

**1.3.3 Record Admin** is responsible for reviewing forms pending publication, approving and publishing forms for client use, or disapproving forms with remarks, and monitoring Activity Logs.

**1.3.4 Staff** is responsible for submitting technical assistance requests, tracking My Requests, marking service complete, submitting feedback, closing or reopening requests, and using Messages.

---

## 2. General Information

The Support Ticketing System of the National Museum of the Philippines (NMP) aims to provide a centralized and efficient platform for monitoring, managing, and tracking technical assistance requests within the organization. The system will improve request visibility, accountability, processing efficiency, and timely action by authorized personnel and offices.

### 2.1 Objectives

The Support Ticketing System of the National Museum of the Philippines (NMP) aims to make the creation, review, submission, approval, assignment, and closure of technical assistance requests easier and more organized. It helps users quickly check the status and progress of TA forms and tickets, reduce delays, and keep a clear record of transactions. The system also provides reports and updates to help offices monitor pending and completed requests.

### 2.2 System Features

**2.2.1 Form Builder.** The system allows authorized Admin users to create TA forms with fields, a print template, field placements, and a procedure section, then submit the form to Records for review.

**2.2.2 Form Review and Publishing.** The system allows Record Admin users to review pending forms, **Approve & publish** them for client use, or **Disapprove** them with remarks for return to Admin.

**2.2.3 Request Submission.** The system allows Staff (Client Portal) and Admin users (Submit TA Request) to submit technical assistance requests using published forms.

**2.2.4 PAMANA Requestor Autofill.** The system fills Division/Section, First Name, Middle Name, Last Name, Email Address, and Designation from PAMANA employee records linked to the signed-in museum username.

**2.2.5 Request Approval.** The system allows Admin users to approve or reject pending client requests. **When a request is approved, its status becomes Open** (not “Approved”). Assignment is performed next from Request Management.

**2.2.6 Personnel Assignment.** The system allows Admin users to assign Open tickets to active Admin users who belong to the **same division as the form creator** (for example, an ICT form is assignable only to ICT Admins). Assigned staff can track work under My Assignments.

**2.2.7 Ticket Status Tracking.** The system allows users to monitor the current status of each ticket, such as pending approval, open, in progress, pending, resolved, closed, rejected, or reopened.

**2.2.8 Service Completion and Feedback.** The system allows the requestor to mark service complete, submit client satisfaction feedback, then close or reopen the request.

**2.2.9 Document Upload and Form Preview.** The system allows users to view the form template and how answers, including PAMANA fields, appear on the printable form.

**2.2.10 Notifications and Alerts.** The system notifies users of pending approvals, pending form reviews, and actionable request updates.

**2.2.11 Role-Based Access Control.** The system restricts access to functions according to the user’s assigned role. **Users, Roles, and Permissions are managed in the Super Admin portal** (not in the Admin sidebar).

**2.2.12 Messaging.** The system supports chats, ticket-linked threads, pokes, and mentions for Admin and Client portals.

**2.2.13 Dashboard.** The system provides a centralized dashboard showing key counts and activities for each portal.

**2.2.14 Reports and Analytics.** The system generates reports on request volume, completion, and client feedback.

**2.2.15 Super Admin Console.** The system provides Super Admin with system overview statistics, portal switching, activity logs, and RBAC management.

### 2.3 System Users and Their Descriptions

**2.3.1 Super Admin.** Has the highest level of system access and is responsible for overall system administration, including managing user roles, permissions, portal access, and system-wide monitoring.

**2.3.2 Admin.** Section Head (ODG Section and Regional Component Museum); Division Head (All except ODG). Manages forms, approvals, assignments, requests, and reports.

**2.3.3 Record Admin.** Responsible for managing and monitoring form review and publishing, including pending forms, published forms, and activity logs.

**2.3.4 Staff.** Employee / client requester responsible for submitting and tracking their own technical assistance requests.

---

## 3. Getting Started

### 3.1 Log-in / Sign In

**3.1.1** To start using the web application, you should log in first. Open any web browser and type the Support Ticketing System address in the address bar (for example, `http://on-prem.x-dcb.net:5173/login` or `http://127.0.0.1:5173/login`). The Support Ticketing System log-in page will be displayed (Figure 1).

**3.1.2** To log in, enter a valid **Username** (museum organization username) and **Password**, then click the **Sign In** button.

**3.1.3** Optionally tick **Remember me** to save your username on this browser for the next visit.

**3.1.4** If you forgot your password, use **Forgot password?** and contact your system administrator to reset your password. Password reset is not self-service in this version.

**Note:** Sign in with your museum organization username so PAMANA can match your employee record for requestor autofill.

*[Screenshot placeholder]*  
**Figure 1 – Support Ticketing System log-in page**

### 3.2 Dashboard

Upon login, the user will be directed to the Dashboard that matches their role:

| Role | Landing page |
|------|----------------|
| Super Admin | `/super-admin/dashboard` |
| Admin | `/admin/dashboard` |
| Record Management | `/records/dashboard` |
| Staff | `/client/dashboard` |

The Dashboard serves as the main landing page of the Support Ticketing System. It provides users with an overview of forms and request activities, statuses, and quick access to frequently used functions.

*[Screenshot placeholder]*  
**Figure 2 – Support Ticketing System Dashboard**

**3.2.1 Super Admin Dashboard.** Displays system-wide statistics (users, forms, tickets), portal access shortcuts, and recent activities.

**3.2.2 Admin Dashboard.** Displays a personalized greeting, a snapshot of TA forms, and pending client requests awaiting approval.

**3.2.3 Records Dashboard.** Displays welcome information and counts for pending forms and published forms.

**3.2.4 Client Dashboard.** Displays Welcome back and an overview of Your requests.

### 3.3 System Navigation

The left-side menu provides access to the main features of the system. The sidebar brand shows **National Museum of the Philippines / Support Ticketing System**. The bottom of the sidebar provides **Settings** and **Logout**. The header includes the notification bell and the current page title.

**3.3.1 Super Admin Navigation**

- **MAIN:** Dashboard, Reports & Analytics  
- **PORTALS / ACCESS:** Admin Portal, Records Portal, Staff/Client Portal  
- **USER & ACCESS MANAGEMENT:** Users, Roles, Permissions  
- **SYSTEM MANAGEMENT:** System Settings, Form Management, Activity Logs / Audit Logs, System Notifications  
- **ACCOUNT:** My Profile, Settings  

**3.3.2 Admin Navigation**

- **MAIN:** Dashboard, Reports, Messages  
- **FORMS:** Form Builder, My Forms  
- **REQUESTS:** Approvals, Request Management, My Assignments, My Requests, Submit TA Request  

*(RBAC is not listed under Admin. Use Super Admin for Users / Roles / Permissions.)*

**3.3.3 Records Navigation**

- **MAIN:** Dashboard  
- **FORMS:** Pending Forms, Published Forms  
- **SYSTEM:** Activity Logs  

**3.3.4 Client Navigation**

- **MAIN:** Dashboard, Messages  
- **REQUESTS:** Submit Request, My Requests, Service Feedback  

**3.3.5 Switch Portal (Super Admin only).** When a Super Admin opens Admin, Records, or Client, a **SWITCH PORTAL** block appears in the sidebar so the user can return to Super Admin or jump to another portal without signing out.

*[Screenshot placeholder]*  
**Figure 3 – System Navigation**

---

## 4. Super Admin Portal

### 4.1 Dashboard

The Super Admin Dashboard shows overall status of the Support Ticketing System — users, forms, requests, and recent activity.

**4.1.1** After signing in as Super Admin, open **Dashboard** under MAIN (or land here automatically).

**4.1.2** Review summary cards such as Total Users, Total Admins, Records Personnel, Staff, Pending Forms, Published Forms, Pending Requests, In Progress, Completed, Closed, and Reopened.

**4.1.3** Use **Portal access** cards to open Admin, Records, or Staff/Client.

**4.1.4** Review **Recent activities**. Each row shows the action summary, actor name, relative and absolute time, and a Form / Ticket type indicator. Click **View all logs** to open Activity Logs / Audit Logs.

*[Screenshot placeholder]*  
**Figure 4 – Super Admin Dashboard**

### 4.2 Portal Access / Switch Portal

**4.2.1** From Super Admin, click **Admin Portal**, **Records Portal**, or **Staff/Client Portal** under PORTALS / ACCESS.

**4.2.2** While inside another portal, use **SWITCH PORTAL** in the sidebar to return to Super Admin or open a different portal.

**4.2.3** Logging out as Super Admin clears sessions for all three portal slots (Admin, Records, Client).

### 4.3 Users, Roles, and Permissions (RBAC)

RBAC is available **only** in the Super Admin portal.

**4.3.1 Users**

1. Open **Users** under USER & ACCESS MANAGEMENT.  
2. Use Search to find employees by name or username.  
3. Filter by role or access status if needed.  
4. Use **Prev / Next** pagination to move through employee pages.  
5. Click **Assign roles** or **Manage roles** for an employee.  
6. Select the appropriate role(s) and save. System roles include Super Admin, Admin, Record Management, and Staff.

**4.3.2 Roles**

1. Open **Roles**.  
2. Review system roles and custom roles.  
3. Create a role if needed (name and optional description).  
4. Manage permissions for a role by selecting capabilities from the catalog.  
5. System / protected roles cannot be deleted.

**4.3.3 Permissions**

1. Open **Permissions**.  
2. Browse the capability catalog grouped by category.  
3. Use search to find a specific permission.  
4. Assign permissions to roles from the Roles page (not by editing permissions in isolation).

*[Screenshot placeholder]*  
**Figure 5 – Super Admin Users / Roles / Permissions**

### 4.4 System Management

**4.4.1 System Settings / My Profile.** Update account display information and password as allowed.

**4.4.2 Form Management.** Opens form-related administration views used by Super Admin for oversight (same form domain as Admin My Forms / Records).

**4.4.3 Activity Logs / Audit Logs.** Displays the system-wide audit trail of significant actions across portals (actor, action, summary, timestamp).

**4.4.4 System Notifications.** Shows overview-driven alerts and recent system events for Super Admin monitoring.

---

## 5. Admin Portal

### 5.1 Form Builder

The Form Builder page allows Admin users to create a Technical Assistance request form through a guided wizard.

**5.1.1** Open **Form Builder** from the FORMS section.

**5.1.2** Complete the wizard in order: **General → Fields → Print Template → Procedure**.

**5.1.3** Use **Back** and **Continue** to move between steps.

**Step 1. General information.** Enter the required form details, including:

- **Form title.** Enter the official title of the TA form.  
- **Description.** Provide a brief description of the form’s purpose.  
- Other general metadata required by the wizard (as shown on screen).

**Step 2. Fields.** Add and configure form fields that requestors will fill out.

- Add field types as needed (for example text, choice, or other supported field types shown in the builder).  
- Mark required fields where appropriate.  
- Default **Requester profile** fields remain available for the print template: Division/Section, First Name, Middle Name, Last Name, Email Address, and Designation.

**Step 3. Print Template.** Place form fields on the printable template so submitted answers appear in the correct locations on the official form layout.

**Step 4. Procedure.** Upload the work procedure / supporting PDF document that Records and requestors may need during review and service.

**5.1.4** When ready for Records review, click **Submit to Records**.

**5.1.5** To keep working later, click **Save as draft instead**.

*[Screenshot placeholder]*  
**Figure 6 – Form Builder**

### 5.2 My Forms

The My Forms page displays forms created by the Admin user, including drafts, pending review, published, and disapproved forms, plus related analytics.

**5.2.1** Open **My Forms** to view forms you created and related analytics.

**5.2.2** Use **New Form / Create Form** to start a new form.

**5.2.3** For a draft, use **Send to Records** when ready for review.

**5.2.4** For a disapproved form, review remarks from Records, edit in Form Builder, then **Resubmit**.

**5.2.5** Published forms become available for Staff (and Admin My Requests) submission.

*[Screenshot placeholder]*  
**Figure 7 – My Forms**

### 5.3 Approvals

The Approvals page displays client TA requests with status **pending approval**.

**5.3.1** Open **Approvals** to review pending client requests.

**5.3.2** Open a request to review the request details and form file.

**5.3.3** Click **Approve / Approve request** to accept the request, or **Reject / Reject request**.

**5.3.4** When rejecting, enter a reason and confirm with **Confirm reject**.

**5.3.5** After approval, the ticket status becomes **Open**. Assignment is **not** completed on the Approvals action alone — proceed to **Request Management** to assign personnel.

*[Screenshot placeholder]*  
**Figure 8 – Approvals**

### 5.4 Request Management

The Request Management page displays client requests and allows Admin users to open ticket details, update status where allowed, assign personnel, and open Request messages.

**5.4.1** Open **Request Management**.

**5.4.2** Locate the ticket (for example an **Open** ticket that needs assignment).

**5.4.3** Open the ticket detail page.

**5.4.4** Under **Assign personnel**, choose an assignee from the list. The list shows **active Admin users in the same division as the form creator** (example: ICT form → ICT Admins only).

**5.4.5** Click **Assign**. After assignment, the ticket typically moves to **in progress** (or remains trackable under My Assignments for the assignee).

**5.4.6** Use **Request messages** when you need a ticket-linked conversation with the people involved in the request.

**5.4.7** Update ticket status when the workflow allows (for example holding as **pending**), following on-screen rules.

*[Screenshot placeholder]*  
**Figure 9 – Request Management / Assign personnel**

### 5.5 My Assignments

The My Assignments page displays requests assigned to the signed-in Admin / ICT personnel for tracking until the client marks the service complete and closes the request.

**5.5.1** Open **My Assignments**.

**5.5.2** Open a ticket to view details, messages, and current status.

**5.5.3** Perform the technical assistance work offline / on-site as required by the request.

**5.5.4** Coordinate with the requestor (Messages / Request messages) until the requestor can mark the service complete.

*[Screenshot placeholder]*  
**Figure 10 – My Assignments**

### 5.6 My Requests / Submit TA Request

Admin users may also act as requestors.

**5.6.1** Open **Submit TA Request** to submit a personal TA request using a published form.

**5.6.2** Confirm that PAMANA autofill populated Division/Section, name, email, and designation when your museum username is linked.

**5.6.3** Complete remaining required fields, optionally use **View form file**, then click **Submit request**.

**5.6.4** Open **My Requests** to track your own submissions.

**5.6.5** From a ticket detail page you may **Mark service complete**, submit feedback, **Close ticket**, or **Reopen request**, as applicable (same requestor actions as Staff).

*[Screenshot placeholder]*  
**Figure 11 – Admin My Requests / Submit TA Request**

### 5.7 Reports

The Reports page, titled **Reports & Analytics**, provides summaries of request volume, completion, and client feedback.

**5.7.1** Open **Reports** under MAIN.

**5.7.2** Review charts and summary metrics available on the page.

**5.7.3** Use the report views to monitor workload and service outcomes for your office.

*[Screenshot placeholder]*  
**Figure 12 – Reports & Analytics**

---

## 6. Records Portal

### 6.1 Pending Forms

The Pending Forms page displays forms with status **Pending Review**.

**6.1.1** Open **Pending Forms** to see forms awaiting recommendation.

**6.1.2** Open a form to review the **Form template** (view-only) and any attached procedure document.

**6.1.3** Under **Recommendation**, select **Approve & publish** or **Disapprove**.

**6.1.4** If disapproving, enter remarks so Admin can correct and resubmit.

**6.1.5** Click **Submit recommendation**.

**6.1.6** Approved forms become **Published**. Disapproved forms return to Admin with remarks.

**Note:** Records reviews **forms for publishing**. Client TA **tickets** go to **Admin Approvals**, not to Records.

*[Screenshot placeholder]*  
**Figure 13 – Pending Forms / Recommendation**

### 6.2 Published Forms

The Published Forms page displays live TA forms available for client submission.

**6.2.1** Open **Published Forms**.

**6.2.2** Review the list of live forms.

**6.2.3** Open a published form when you need to confirm template content after publication.

*[Screenshot placeholder]*  
**Figure 14 – Published Forms**

### 6.3 Activity Logs

The Activity Logs page displays the audit trail of records-related actions.

**6.3.1** Open **Activity Logs**.

**6.3.2** Review When, Actor, Action, and Summary columns for each event.

**Note:** Messaging is not available in the Records portal navigation. Records focuses on form review and publishing.

*[Screenshot placeholder]*  
**Figure 15 – Activity Logs**

---

## 7. Client Portal (Staff)

### 7.1 Submit Request

**7.1.1** Open **Submit Request**.

**7.1.2** Under **Published form**, select the TA form you need.

**7.1.3** The system loads your requestor profile from PAMANA when your museum username is linked.

**7.1.4** Complete any remaining required form fields.

**7.1.5** Click **View form file** to preview how answers appear on the printable template.

**7.1.6** Click **Submit request**. The ticket is created with status **pending approval** for Admin review.

*[Screenshot placeholder]*  
**Figure 16 – Submit Request**

### 7.2 My Requests

**7.2.1** Open **My Requests** to list tickets linked to your account.

**7.2.2** Click **View details** or the actionable link shown to open the ticket.

**7.2.3** Monitor status changes: pending approval → Open (after Admin approval) → in progress (after assignment) → resolved / closed.

**7.2.4** When ICT work is finished and the status allows it, click **Mark service complete**.

**7.2.5** Complete the Client Satisfaction Survey / feedback step.

**7.2.6** When ready, click **Close ticket**. To continue work, click **Reopen request**.

*[Screenshot placeholder]*  
**Figure 17 – My Requests / ticket detail**

### 7.3 Service Feedback

The Service Feedback page displays requests that still need feedback action. Follow the on-screen survey and confirmation steps for each pending item.

**7.3.1** Open **Service Feedback**.

**7.3.2** Select a pending feedback item.

**7.3.3** Answer the survey questions and submit.

**7.3.4** Proceed to close the ticket when prompted / when the workflow allows.

*[Screenshot placeholder]*  
**Figure 18 – Service Feedback**

---

## 8. Shared Features

### 8.1 Messages

Available in **Admin** and **Client** portals under **Messages**. Users may open Chats, create a **New message**, **Send** messages, use **Poke**, and open **Request messages** from a ticket detail page.

**8.1.1** Open **Messages**.

**8.1.2** Select an existing conversation or start a new one.

**8.1.3** Type your message. Use **@** mentions when available to notify participants.

**8.1.4** Use **Poke** when you need to nudge another user about an unanswered conversation (as provided by the UI).

**8.1.5** From a ticket detail page, open **Request messages** for a ticket-linked thread with the people involved in that request.

*[Screenshot placeholder]*  
**Figure 19 – Messages**

### 8.2 Notifications

Click the notification bell in the header.

**8.2.1 Admin** notifications focus on pending approvals, messages, and pokes.

**8.2.2 Records** notifications focus on pending forms awaiting review.

**8.2.3 Client** notifications focus on actionable request updates (for example rejected, reopened, or next steps).

*[Screenshot placeholder]*  
**Figure 20 – Notifications**

### 8.3 Settings

Open **Settings** from the sidebar footer.

**8.3.1** Under **Account**, update Display name, Division / office, and Designation as allowed, then **Save profile**.

**8.3.2** Under **Password**, enter the current password and new password, then **Change password**.

*[Screenshot placeholder]*  
**Figure 21 – Settings**

---

## 9. Status Reference

### 9.1 Form Statuses

**9.1.1 Draft.** Saved by Admin; not yet submitted to Records.

**9.1.2 Pending Review.** Submitted to Records; awaiting recommendation.

**9.1.3 Published.** Approved by Records; available for client submission.

**9.1.4 Disapproved.** Returned to Admin with remarks.

### 9.2 Ticket Statuses

**9.2.1 pending approval.** Awaiting Admin approve/reject.

**9.2.2 open.** Set when Admin **approves** the request. Ticket is active and ready for assignment / processing.

**9.2.3 rejected.** Rejected with reason.

**9.2.4 in progress.** Personnel assigned / work ongoing.

**9.2.5 pending.** Holding status set by Admin when allowed.

**9.2.6 resolved.** Requestor marked service complete; feedback/close next.

**9.2.7 closed.** Closed after feedback.

**9.2.8 reopened.** Reopened by requestor for further action.

**Important:** Approving a request does **not** leave the ticket in an “Approved” status. The system sets the status to **Open**.

### 9.3 End-to-End Workflow Summary

**Phase 1 — Form publishing**

1. Admin builds form in Form Builder (General → Fields → Print Template → Procedure).  
2. Admin clicks **Submit to Records** (or Save as draft, then Send to Records later).  
3. Record Admin reviews Pending Forms and chooses **Approve & publish** or **Disapprove** (with remarks).  
4. Published forms become available under Client **Submit Request** / Admin **Submit TA Request**.

**Phase 2 — Technical assistance request**

1. Staff (or Admin as requestor) submits via **Submit Request** / **Submit TA Request** → status **pending approval**.  
2. Admin reviews on **Approvals** → **Approve** sets status to **Open**, or **Reject** with reason.  
3. Admin opens **Request Management**, assigns personnel from the **form owner’s division** → work tracked under **My Assignments**.  
4. Assignee performs the service; parties may use Messages / Request messages.  
5. Requestor clicks **Mark service complete** → submits feedback → **Close ticket** (or **Reopen request** if more work is needed).

---

## 10. Frequently Asked Questions

**10.1 Why are my Division / Name / Email empty on the form preview?**  
Sign in with your museum username so PAMANA can match your employee record. If no PAMANA staff record is found, profile fields cannot auto-fill.

**10.2 Do client submissions go to Records?**  
No. Records reviews **forms** for publishing. Client TA **tickets** go to **Admin Approvals**.

**10.3 Can Admin submit a TA request?**  
Yes. Use **Submit TA Request** and track it under **My Requests**.

**10.4 Why is Messages missing in Records?**  
Messaging is available in Admin and Client portals only.

**10.5 Where do I manage Users / Roles / Permissions?**  
In the **Super Admin** portal only. RBAC was removed from the Admin sidebar.

**10.6 After I approve a request, why does it say Open instead of Approved?**  
That is correct. Approve sets the ticket status to **Open**. Next, assign personnel from **Request Management**.

**10.7 Why is the assignee list limited?**  
Assignees are filtered to **active Admins in the same division as the form creator** (for example ICT forms → ICT only).

**10.8 What are the current system roles?**  
Super Admin, Admin (Section Head / Division Head scope), Record Management, and Staff.

---

*— End of Employee User Manual V1.0 —*
