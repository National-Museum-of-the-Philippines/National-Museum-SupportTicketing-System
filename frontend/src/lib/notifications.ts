import { ticketNeedsFeedback, ticketReadyToClose, ticketCanMarkComplete } from "@/lib/ticket-workflow";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time?: string;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
};
export function formatNotificationTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function adminApprovalNotifications(
  tickets: Array<{
    _id: string;
    ticketNumber: string;
    formTitle: string;
    creatorName: string;
    createdAt: string;
  }>,
): NotificationItem[] {
  return tickets.slice(0, 8).map((t) => ({
    id: t._id,
    title: t.ticketNumber,
    message: `${t.creatorName} submitted ${t.formTitle}`,
    time: t.createdAt,
    to: "/admin/approvals",
  }));
}

export function recordsPendingNotifications(
  forms: Array<{
    _id: string;
    title: string;
    refNumber: string;
    createdAt: string;
    createdBy?: { name: string };
  }>,
): NotificationItem[] {
  return forms.slice(0, 8).map((f) => ({
    id: f._id,
    title: f.title,
    message: `Submitted by ${f.createdBy?.name ?? "Admin"} · ${f.refNumber}`,
    time: f.createdAt,
    to: "/records/forms/$formId",
    params: { formId: f._id },
  }));
}

export function clientTicketNotifications(
  tickets: Array<{
    _id: string;
    ticketNumber: string;
    formTitle: string;
    status: string;
    feedbackSubmitted?: boolean;
    updatedAt?: string;
    createdAt: string;
  }>,
): NotificationItem[] {
  const actionable = tickets.filter(
    (t) =>
      ticketCanMarkComplete(t) ||
      ticketNeedsFeedback(t) ||
      ticketReadyToClose(t) ||
      ["pending_approval", "for_process_owner", "for_client_approval", "rejected", "reopened", "approved"].includes(t.status),
  );

  return actionable.slice(0, 8).map((t) => ({
    id: t._id,
    title: t.ticketNumber,
    message: clientStatusMessage(t.status, t.formTitle, t.feedbackSubmitted),
    time: t.updatedAt ?? t.createdAt,
    to: "/client/requests/$ticketId",
    params: { ticketId: t._id },
  }));
}

function clientStatusMessage(
  status: string,
  formTitle: string,
  feedbackSubmitted?: boolean,
): string {
  switch (status) {
    case "pending_approval":
      return `${formTitle} — awaiting admin approval`;
    case "for_client_approval":
      return `${formTitle} — for client approval`;
    case "for_process_owner":
      return `${formTitle} — for process owner`;
    case "approved":
      return `${formTitle} — approved by admin`;
    case "open":
    case "in_progress":
    case "pending":
      return `${formTitle} — mark service complete when work is done`;
    case "resolved":
      return feedbackSubmitted
        ? `${formTitle} — ready to close after feedback`
        : `${formTitle} — service complete, submit feedback`;
    case "rejected":
      return `${formTitle} — request rejected`;
    case "reopened":
      return `${formTitle} — reopened for follow-up`;
    default:
      return formTitle;
  }
}
