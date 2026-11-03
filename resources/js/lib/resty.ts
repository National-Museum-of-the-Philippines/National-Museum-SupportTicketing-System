import type { ApiUser } from "@/lib/api/types";

/** The redesigned dashboard and reports are only switched on for Resty's account. */
export function isRestyAccount(user: ApiUser | null | undefined) {
  return !!user?.email && user.email.toLowerCase().startsWith("resty.morancil");
}

/** Resty's and Renielle's My Forms reports are finished and keep every section; other admins get a shorter one for now. */
export function hasFullReport(user: ApiUser | null | undefined) {
  const email = user?.email?.toLowerCase() ?? "";
  return email.startsWith("resty.morancil") || email.startsWith("renielle.rogel");
}

/** Renielle's My Forms shows only the form's charts: no banner, KPI cards, staff, monthly or open-request sections. */
export function isRenielleAccount(user: ApiUser | null | undefined) {
  return (user?.email?.toLowerCase() ?? "").startsWith("renielle.rogel");
}
