import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BackLink, ActionPanel, FlowNotice, PageLoader, StatusBadge, WorkspacePageHeader } from "@/components/layout/workspace-ui";
import { TicketRequestDetails } from "@/components/tickets/TicketRequestDetails";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import type { TicketStatus } from "@/lib/api/types";
import { getTicketDivision } from "@/lib/ticket-details";
import {
  canManageTicketRequest,
  hasActionOfficerWorkflow,
  isCurrentWorkflowActor,
} from "@/lib/ticket-workflow";
import { ADMIN_APPROVALS, ADMIN_MESSAGES, ADMIN_REQUESTS } from "@/lib/navigation";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";

/** Admin may set these manually — client marks complete, feedback, and close. */
const ADMIN_STATUSES: TicketStatus[] = ["in_progress", "pending"];

export const Route = createFileRoute("/admin/requests/$ticketId")({
  component: TicketDetailPage,
});

function invalidateAdminTicketQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["pending-tickets"] });
  void qc.invalidateQueries({ queryKey: ["admin-tickets-pending"] });
  void qc.invalidateQueries({ queryKey: ["admin-tickets-dashboard"] });
  void qc.invalidateQueries({ queryKey: ["all-tickets"] });
  void qc.invalidateQueries({ queryKey: ["assigned-tickets"] });
}

function TicketDetailPage() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canQuery, user } = useAdminSession();
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api.getTicket(ticketId, "admin"),
    enabled: canQuery,
  });
  const { data: assigneeData } = useQuery({
    queryKey: ["assignees", ticketId],
    queryFn: () => api.listAssignees(ticketId),
    enabled: canQuery && Boolean(ticketId),
  });

  const approve = useMutation({
    mutationFn: () => api.approveTicket(ticketId, "admin"),
    onSuccess: (res) => {
      const phase = res.ticket?.processOwnerPhase;
      toast.success(
        phase === "assignment"
          ? "Approved — ready for task assignment"
          : "Request approved",
      );
      invalidateAdminTicketQueries(qc);
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not approve request.");
    },
  });

  const reject = useMutation({
    mutationFn: (reason: string) => api.rejectTicket(ticketId, reason, "admin"),
    onSuccess: () => {
      toast.success("Request rejected");
      setRejectReason("");
      invalidateAdminTicketQueries(qc);
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not reject request.");
    },
  });

  const assign = useMutation({
    mutationFn: () => api.assignTicket(ticketId, selectedAssigneeIds, "admin"),
    onSuccess: () => {
      toast.success("Personnel assigned");
      invalidateAdminTicketQueries(qc);
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      void navigate({ to: ADMIN_REQUESTS, replace: true });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not assign personnel.");
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: TicketStatus) => api.updateTicketStatus(ticketId, status, "admin"),
    onSuccess: () => {
      toast.success("Status updated");
      invalidateAdminTicketQueries(qc);
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not update status.");
    },
  });

  const ticket = data?.ticket;

  useEffect(() => {
    if (!ticket?.assignedTo?.length) {
      setSelectedAssigneeIds([]);
      return;
    }
    setSelectedAssigneeIds(ticket.assignedTo.map((u) => u._id));
  }, [ticket?._id, ticket?.assignedTo]);

  const toggleAssignee = (id: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  if (!canQuery || isLoading || !ticket) {
    return <PageLoader label="Loading request…" />;
  }

  const isInApprovalQueue =
    ticket.status === "pending_approval" ||
    ticket.status === "for_process_owner" ||
    ticket.status === "for_client_approval";
  const isClientApproval = ticket.status === "for_client_approval";
  const isProcessOwner =
    ticket.status === "for_process_owner" || ticket.status === "pending_approval";
  const processOwnerPhase = ticket.processOwnerPhase ?? "approval";
  const awaitingProcessOwnerApproval = isProcessOwner && processOwnerPhase !== "assignment";
  const awaitingTaskAssignment = isProcessOwner && processOwnerPhase === "assignment";
  const alreadyAssigned = Boolean(ticket.assignedTo?.length);
  // Per-form Action Officer workflow; legacy forms (no workflow) keep any-admin behavior.
  const isWorkflow = hasActionOfficerWorkflow(ticket);
  const isRequestManager = canManageTicketRequest(ticket, user?.id);
  const isStepOfficer = !isWorkflow || isCurrentWorkflowActor(ticket, user?.id);
  const canApprove = isClientApproval || (awaitingProcessOwnerApproval && isStepOfficer);
  const canAssignTask = awaitingTaskAssignment && isRequestManager && !alreadyAssigned;
  const backTo = isInApprovalQueue ? ADMIN_APPROVALS : ADMIN_REQUESTS;
  const isAwaitingClient = ticket.status === "resolved";
  const canAssign =
    isRequestManager &&
    !alreadyAssigned &&
    (awaitingTaskAssignment ||
      (!isInApprovalQueue &&
        !isAwaitingClient &&
        ticket.status !== "closed" &&
        ticket.status !== "rejected"));

  return (
    <div className="page-shell">
      <BackLink to={backTo} label={isInApprovalQueue ? "Back to approvals" : "Back to requests"} />

      <WorkspacePageHeader
        title={ticket.ticketNumber}
        description={ticket.title}
        actions={
          ticket.status !== "closed" ? (
            <Link to={ADMIN_MESSAGES} search={{ ticket: ticketId }}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <MessageCircle className="h-4 w-4" />
                Request messages
              </Button>
            </Link>
          ) : null
        }
        meta={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <StatusBadge status={ticket.status} />
            {awaitingTaskAssignment ? (
              <span className="text-muted-foreground">· Ready for task assignment</span>
            ) : alreadyAssigned ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Assigned
              </span>
            ) : null}
            {ticket.creatorName ? (
              <span className="text-muted-foreground">· Client: {ticket.creatorName}</span>
            ) : null}
            {getTicketDivision(ticket) ? (
              <span className="text-muted-foreground">
                · Division: {getTicketDivision(ticket)}
              </span>
            ) : null}
          </div>
        }
        bordered={false}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <TicketRequestDetails ticket={ticket} className="lg:col-span-2" />

        <div className="space-y-4">
          {canApprove ? (
            <ActionPanel
              title="Approve or reject"
              description={
                isClientApproval
                  ? "Review the request details before approving or rejecting."
                  : "Action Officer approval — after all approvals, the last officer assigns personnel."
              }
            >
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending || reject.isPending}
                >
                  Approve request
                </Button>
              </div>
              <div className="mt-4 space-y-2 border-t border-border/70 pt-4">
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reject.mutate(rejectReason)}
                  disabled={!rejectReason.trim() || approve.isPending || reject.isPending}
                >
                  Reject request
                </Button>
              </div>
            </ActionPanel>
          ) : null}

          {canAssignTask ? (
            <ActionPanel
              title="Task assignment"
              description={
                assigneeData?.division
                  ? `Select personnel from your section (${assigneeData.division}). After assignment the request becomes In Progress.`
                  : "Select personnel from your section. After assignment the request becomes In Progress."
              }
            >
              <FlowNotice tone="info" title="Requestor's division">
                <span className="font-medium text-foreground">
                  {getTicketDivision(ticket) || "Not specified"}
                </span>
                {ticket.creatorName ? (
                  <span className="text-muted-foreground"> · {ticket.creatorName}</span>
                ) : null}
              </FlowNotice>
              {ticket.assignedTo?.length ? (
                <p className="text-sm">
                  Currently assigned:{" "}
                  <span className="font-medium">
                    {ticket.assignedTo.map((u) => u.name).join(", ")}
                  </span>
                </p>
              ) : null}
              <div className="max-w-md space-y-2">
                <Label>
                  {assigneeData?.division
                    ? `${assigneeData.division} personnel`
                    : "Personnel (your section)"}
                </Label>
                <div
                  className={cn(
                    "max-h-48 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2 shadow-sm",
                  )}
                >
                  {assigneeData?.users.length ? (
                    assigneeData.users.map((u) => {
                      const checked = selectedAssigneeIds.includes(u._id);
                      return (
                        <label
                          key={u._id}
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60",
                            checked && "bg-muted/40",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => toggleAssignee(u._id)}
                          />
                          <span>
                            <span className="font-medium">{u.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {u.division}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      {assigneeData?.division
                        ? `No active personnel found in ${assigneeData.division}.`
                        : "No personnel found in your section."}
                    </p>
                  )}
                </div>
                {selectedAssigneeIds.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedAssigneeIds.length} selected
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => assign.mutate()}
                disabled={selectedAssigneeIds.length === 0 || assign.isPending}
              >
                {assign.isPending ? "Assigning…" : "Assign"}
              </Button>
              <div className="mt-4 space-y-2 border-t border-border/70 pt-4">
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reject.mutate(rejectReason)}
                  disabled={!rejectReason.trim() || assign.isPending || reject.isPending}
                >
                  Reject request
                </Button>
              </div>
            </ActionPanel>
          ) : null}

          {!isInApprovalQueue ? (
            <>
              {alreadyAssigned ? (
                <FlowNotice tone="success" icon={CheckCircle2} title="Assigned">
                  {ticket.assignedTo!.map((u) => u.name).join(", ")}
                </FlowNotice>
              ) : canAssign ? (
              <ActionPanel
                title="Assign personnel"
                description={
                  assigneeData?.division
                    ? `Only personnel from your section (${assigneeData.division}) are listed.`
                    : "Select personnel from your section for this request."
                }
              >
                <FlowNotice tone="info" title="Requestor's division">
                  <span className="font-medium text-foreground">
                    {getTicketDivision(ticket) || "Not specified"}
                  </span>
                  {ticket.creatorName ? (
                    <span className="text-muted-foreground"> · {ticket.creatorName}</span>
                  ) : null}
                </FlowNotice>
                {ticket.assignedTo?.length ? (
                  <p className="text-sm">
                    Currently assigned:{" "}
                    <span className="font-medium">
                      {ticket.assignedTo.map((u) => u.name).join(", ")}
                    </span>
                  </p>
                ) : null}
                <div className="max-w-md space-y-2">
                  <Label>
                    {assigneeData?.division
                      ? `${assigneeData.division} personnel`
                      : "Personnel (your section)"}
                  </Label>
                  <div
                    className={cn(
                      "max-h-48 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2 shadow-sm",
                    )}
                  >
                    {assigneeData?.users.length ? (
                      assigneeData.users.map((u) => {
                        const checked = selectedAssigneeIds.includes(u._id);
                        return (
                          <label
                            key={u._id}
                            className={cn(
                              "flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60",
                              checked && "bg-muted/40",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={() => toggleAssignee(u._id)}
                            />
                            <span>
                              <span className="font-medium">{u.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {u.division}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        {assigneeData?.division
                          ? `No active personnel found in ${assigneeData.division}.`
                          : "No personnel available for this form's division."}
                      </p>
                    )}
                  </div>
                  {selectedAssigneeIds.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedAssigneeIds.length} selected
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  onClick={() => assign.mutate()}
                  disabled={selectedAssigneeIds.length === 0 || assign.isPending}
                >
                  {assign.isPending ? "Assigning…" : "Assign"}
                </Button>
              </ActionPanel>
              ) : null}

              {isAwaitingClient ? (
                <FlowNotice tone="success" title="Waiting for client">
                  Client marked the service complete. Waiting for feedback submission and ticket
                  closure.
                </FlowNotice>
              ) : null}

              {isRequestManager && !isAwaitingClient && ticket.status !== "closed" ? (
                <ActionPanel
                  title="Update status"
                  description="The client marks the service complete when work is done, then submits feedback and closes the request."
                >
                  <div className="flex flex-wrap gap-2">
                    {ADMIN_STATUSES.map((s) => {
                      const isCurrent = ticket.status === s;
                      return (
                        <Button
                          key={s}
                          size="sm"
                          variant={isCurrent ? "default" : "outline"}
                          onClick={() => updateStatus.mutate(s)}
                          disabled={updateStatus.isPending || isCurrent}
                        >
                          {s.replace(/_/g, " ")}
                        </Button>
                      );
                    })}
                  </div>
                </ActionPanel>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
