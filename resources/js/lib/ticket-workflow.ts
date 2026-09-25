import type { TicketRecord } from "@/lib/api/types";

const COMPLETABLE_STATUSES = ["open", "in_progress", "pending", "reopened"] as const;

/** Work in progress — client may mark service complete when satisfied. */
export function ticketCanMarkComplete(ticket: Pick<TicketRecord, "status">) {
  return COMPLETABLE_STATUSES.includes(ticket.status as (typeof COMPLETABLE_STATUSES)[number]);
}

/** Client marked service done — submit feedback next. */
export function ticketNeedsFeedback(ticket: Pick<TicketRecord, "status" | "feedbackSubmitted">) {
  return ticket.status === "resolved" && !ticket.feedbackSubmitted;
}

/** Feedback submitted — client may close the request. */
export function ticketReadyToClose(ticket: Pick<TicketRecord, "status" | "feedbackSubmitted">) {
  return ticket.status === "resolved" && ticket.feedbackSubmitted;
}

/** Form has an Action Officer workflow configured (otherwise legacy any-admin behavior). */
export function hasActionOfficerWorkflow(ticket: Pick<TicketRecord, "actionOfficerWorkflow">) {
  return Boolean(ticket.actionOfficerWorkflow?.configured);
}

/** Viewer is the Action Officer whose step it is now (approval or Request Manager). */
export function isCurrentWorkflowActor(
  ticket: Pick<TicketRecord, "actionOfficerWorkflow">,
  userId: string | undefined,
) {
  const actor = ticket.actionOfficerWorkflow?.currentActor;
  return Boolean(actor && userId && actor.userId === userId);
}

/** Viewer may manage the request (assign, status). After AO approval, any admin. */
export function canManageTicketRequest(
  ticket: Pick<TicketRecord, "actionOfficerWorkflow" | "processOwnerPhase" | "status">,
  userId: string | undefined,
) {
  const workflow = ticket.actionOfficerWorkflow;
  if (!workflow?.configured) return true;
  if (!userId) return false;
  if (workflow.requestManager.userId === userId) return true;
  if (ticket.processOwnerPhase === "assignment") return true;
  return !["for_client_approval", "for_process_owner", "pending_approval"].includes(ticket.status);
}

export function countTicketsNeedingFeedback(
  tickets: Array<Pick<TicketRecord, "status" | "feedbackSubmitted">>,
) {
  return tickets.filter(ticketNeedsFeedback).length;
}
