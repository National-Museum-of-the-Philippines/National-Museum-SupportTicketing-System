import type { TicketRecord } from "@/lib/api/types";

/** Official NMP Client Satisfaction Survey form */
export function getClientFeedbackUrl(
  ticket?: Pick<TicketRecord, "ticketNumber" | "_id">,
): string | null {
  const base = (import.meta.env.VITE_CLIENT_FEEDBACK_URL as string | undefined)?.trim();
  if (!base) return null;

  try {
    const url = new URL(base);
    if (ticket?.ticketNumber) url.searchParams.set("ticket", ticket.ticketNumber);
    if (ticket?._id) url.searchParams.set("requestId", ticket._id);
    return url.toString();
  } catch {
    return base;
  }
}

export function isClientFeedbackConfigured() {
  return Boolean(getClientFeedbackUrl());
}
