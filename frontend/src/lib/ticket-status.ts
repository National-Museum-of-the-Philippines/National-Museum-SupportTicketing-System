import type { TicketStatus } from "@/lib/api/types";

export type StatusTone = "neutral" | "warning" | "info" | "success" | "danger";

export function formatTicketStatus(status: string): string {
  switch (status) {
    case "for_client_approval":
      return "For Client Approval";
    case "for_process_owner":
      return "For Process Owner";
    case "pending_approval":
      return "Pending Approval";
    default:
      return status.replace(/_/g, " ");
  }
}

export function ticketStatusTone(status: TicketStatus | string): StatusTone {
  switch (status) {
    case "pending_approval":
    case "for_client_approval":
    case "for_process_owner":
    case "pending":
    case "reopened":
      return "warning";
    case "approved":
    case "open":
    case "in_progress":
      return "info";
    case "resolved":
    case "closed":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export const statusToneClass: Record<StatusTone, string> = {
  neutral: "status-badge-neutral",
  warning: "status-badge-warning",
  info: "status-badge-info",
  success: "status-badge-success",
  danger: "status-badge-danger",
};
