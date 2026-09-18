export const LOGIN = "/login";

export const SUPER_ADMIN_DASHBOARD = "/super-admin/dashboard";
export const SUPER_ADMIN_REPORTS = "/super-admin/reports";
export const SUPER_ADMIN_USERS = "/super-admin/users";
export const SUPER_ADMIN_ROLES = "/super-admin/roles";
export const SUPER_ADMIN_PERMISSIONS = "/super-admin/permissions";
export const SUPER_ADMIN_SETTINGS = "/super-admin/settings";
export const SUPER_ADMIN_PROFILE = "/super-admin/profile";
export const SUPER_ADMIN_FORMS = "/super-admin/forms";
export const SUPER_ADMIN_ACTIVITY = "/super-admin/activity";
export const SUPER_ADMIN_NOTIFICATIONS = "/super-admin/notifications";

export const ADMIN_DASHBOARD = "/admin/dashboard";
export const ADMIN_FORMS = "/admin/forms";
export const ADMIN_MY_FORMS = "/admin/my-forms";
export const ADMIN_APPROVALS = "/admin/approvals";
export const ADMIN_REQUESTS = "/admin/requests";
export const ADMIN_MY_REQUESTS = "/admin/my-requests";
export const ADMIN_MY_REQUESTS_SUBMIT = "/admin/submit-request";
export const ADMIN_ASSIGNED = "/admin/assigned";
export const ADMIN_REPORTS = "/admin/reports";
export const ADMIN_MESSAGES = "/admin/messages";
export const ADMIN_SETTINGS = "/admin/settings";

export const RECORDS_DASHBOARD = "/records/dashboard";
export const RECORDS_PENDING = "/records/pending";
export const RECORDS_PUBLISHED = "/records/published";
export const RECORDS_ACTIVITY = "/records/activity";
export const RECORDS_MESSAGES = "/records/messages";
export const RECORDS_SETTINGS = "/records/settings";

export const CLIENT_DASHBOARD = "/client/dashboard";
export const CLIENT_SUBMIT = "/client/submit";
export const CLIENT_REQUESTS = "/client/requests";
export const CLIENT_REVIEW_RECOMMENDING = "/client/for-review-recommending";
export const CLIENT_REVIEW_SUPERVISOR = "/client/for-review-supervisor";
export const CLIENT_REVIEW_ACTION_OFFICER = "/client/for-review-action-officer";
export const CLIENT_ASSIGNED = "/client/assigned";
export const CLIENT_FEEDBACK = "/client/feedback";
export const CLIENT_MESSAGES = "/client/messages";
export const CLIENT_SETTINGS = "/client/settings";

export function settingsPathForSlot(slot: "admin" | "records" | "client" | null | undefined) {
  if (slot === "admin") return ADMIN_SETTINGS;
  if (slot === "records") return RECORDS_SETTINGS;
  if (slot === "client") return CLIENT_SETTINGS;
  return LOGIN;
}

export function isSuperAdminRole(role: string | undefined) {
  return role === "super_admin";
}

export function isAdminRole(role: string | undefined) {
  return role === "admin" || role === "super_admin";
}
export function isClientRole(role: string | undefined) {
  // Admins and Super Admin may also use the client portal to submit their own requests.
  return role === "user" || role === "admin" || role === "super_admin";
}
export function isRecordsRole(role: string | undefined) {
  return role === "record_management" || role === "super_admin";
}

/** After unified login, redirect by role */
export function dashboardForRole(role: string): string {
  if (isSuperAdminRole(role)) return SUPER_ADMIN_DASHBOARD;
  if (role === "admin") return ADMIN_DASHBOARD;
  if (role === "record_management") return RECORDS_DASHBOARD;
  if (role === "user") return CLIENT_ASSIGNED;
  if (isClientRole(role)) return CLIENT_DASHBOARD;
  return LOGIN;
}
