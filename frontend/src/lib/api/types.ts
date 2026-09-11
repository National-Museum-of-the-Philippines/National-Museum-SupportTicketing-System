export type Role = "super_admin" | "admin" | "record_management" | "user";

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  division: string;
  designation?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
};

export type FormStatus = "draft" | "pending_review" | "published" | "disapproved";

export type TicketStatus =
  | "pending_approval"
  | "for_client_approval"
  | "for_process_owner"
  | "approved"
  | "rejected"
  | "open"
  | "in_progress"
  | "pending"
  | "resolved"
  | "closed"
  | "reopened";

export type LiveFormField = {
  id: string;
  type: string;
  variable: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  numberMode?: "integer" | "decimal";
};

export type PrintFieldPlacement = {
  id: string;
  variable: string;
  label: string;
  xPct: number;
  yPct: number;
};

export type FormRecord = {
  _id: string;
  title: string;
  description?: string;
  department?: string;
  requireRecommendingOfficer?: boolean;
  requireImmediateSupervisor?: boolean;
  actionOfficerCount?: number;
  actionOfficers?: Array<{
    userId: string;
    name: string;
    email?: string;
    division?: string;
  }>;
  refNumber: string;
  effectivity: string;
  version: string;
  status: FormStatus;
  fields: LiveFormField[];
  signatories: Array<{ id: string; division: string; name: string }>;
  printTemplate?: string;
  printTemplateImagePath?: string;
  printPlacements?: PrintFieldPlacement[];
  printPlacementFontSize?: number;
  workProcedureName?: string;
  workProcedurePath?: string;
  reviewRemarks?: string;
  reviewedAt?: string;
  submittedForReviewAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { _id: string; name: string; email: string; division: string };
};

export type TicketRecord = {
  _id: string;
  ticketNumber: string;
  formId: string | FormRecord;
  formTitle: string;
  title: string;
  description: string;
  creatorName: string;
  creatorEmail?: string;
  division: string;
  answers: Record<string, unknown>;
  attachmentUrl: string;
  attachmentName: string;
  attachmentMimeType: string;
  status: TicketStatus;
  clientApprovalStage?: string | null;
  processOwnerApprovalsDone?: number;
  processOwnerPhase?: "approval" | "assignment" | string | null;
  rejectionReason?: string;
  assignedTo?: Array<{ _id: string; name: string; email: string; division: string }>;
  feedbackRating?: number | null;
  feedbackComment?: string;
  feedbackSubmitted?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActivityRecord = {
  _id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
};

export type NamedCount = {
  name: string;
  count: number;
  percent: number;
};

export type MyFormsAnalytics = {
  rangeLabel: string;
  summary: {
    totalRequests: number;
    totalRequestsChangePct: number | null;
    totalDivisions: number;
    divisionsChangePct: number | null;
    mostRequestedService: string;
    mostRequestedCount: number;
    mostRequestedPercent: number;
    requestsThisMonth: number;
    requestsThisMonthChangePct: number | null;
  };
  byDivision: NamedCount[];
  byService: NamedCount[];
  monthlyTrend: Array<{ month: string; monthKey: string; count: number }>;
  insights: {
    mostActiveDivision: string;
    mostRequestedService: string;
    fastestGrowing: string;
    topSharePercent: number;
    averagePerDay: number;
  };
  topDivisions: NamedCount[];
  forms: Array<{
    _id: string;
    title: string;
    refNumber: string;
    status: string;
    requestCount: number;
    lastSubmissionAt: string | null;
    updatedAt: string;
    reviewRemarks?: string;
    monthlyTrend: Array<{ month: string; monthKey: string; count: number }>;
  }>;
};

export type MessageableUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  division: string;
};

export type ConversationRecord = {
  _id: string;
  type: "direct" | "group" | "ticket";
  title: string;
  subtitle?: string;
  isGlobal: boolean;
  ticketId?: string | null;
  ticketStatus?: TicketStatus | null;
  ticketTitle?: string;
  threadParticipants?: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastSenderName: string;
  otherUser?: MessageableUser;
};

export type MessageMention = {
  userId: string;
  userName: string;
};

export type ConversationMessageRecord = {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  body: string;
  mentions?: MessageMention[];
  isSystem?: boolean;
  createdAt: string;
};

export type MentionRecord = {
  _id: string;
  conversationId: string;
  messageId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: Role | string;
  toUserId: string;
  preview: string;
  createdAt: string;
};

export type PokeRecord = {
  _id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: Role | string;
  toUserId: string;
  conversationId: string | null;
  createdAt: string;
};

export type FormReviewDecision = "approved" | "disapproved";

export type RbacRole = {
  id: number;
  name: string;
  description: string | null;
  permissionCount?: number;
  userCount?: number;
  permissionIds?: number[];
};

export type RbacPermission = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  roleCount: number;
};

export type RbacEmployee = {
  id: number;
  name: string;
  email: string;
  username: string;
  roles: Array<{ id: number; name: string }>;
  hasRoles: boolean;
};

export type RbacEmployeesResponse = {
  items: RbacEmployee[];
  total: number;
  page: number;
  perPage: number;
  from: number;
  to: number;
};

export type RbacSummary = {
  activeEmployees: number;
  withRoles: number;
  needsRoleAssignment: number;
};
