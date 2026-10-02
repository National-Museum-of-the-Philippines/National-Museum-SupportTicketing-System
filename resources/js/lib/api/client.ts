import type {
  ActivityRecord,
  ApiUser,
  ConversationMessageRecord,
  ConversationRecord,
  FormRecord,
  FormReviewDecision,
  MentionRecord,
  MessageableUser,
  MyFormsAnalytics,
  PokeRecord,
  RbacEmployee,
  RbacEmployeesResponse,
  RbacPermission,
  RbacRole,
  RbacSummary,
  TicketRecord,
  TicketStatus,
  UploadedFileRecord,
} from "./types";
import { apiBase } from "@/lib/api-base";
import { ajax } from "@/lib/ajax";
import { LOGIN } from "@/lib/navigation";
import {
  currentRoutePath,
  getSession,
  getTokenForSlot,
  notifySessionChanged,
  pathToSlot,
  setSession,
  type PortalSlot,
} from "@/lib/sessions";

const API_BASE = apiBase();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const LOGIN_PATH = "/api/auth/login";
const ALL_SLOTS: PortalSlot[] = ["admin", "records", "client"];

/**
 * The API rejected the saved login (expired token, server secret changed, user
 * deactivated). Drop every slot holding that token — super admin seeds all
 * three — and send the user to sign in again, otherwise the portal looks
 * logged in while every request fails with 401.
 */
function handleUnauthorized(slot: PortalSlot | null, token: string | null) {
  if (!slot || typeof window === "undefined") return;
  if (token) {
    let cleared = false;
    for (const s of ALL_SLOTS) {
      if (getSession(s)?.token === token) {
        setSession(s, null, { notify: false });
        cleared = true;
      }
    }
    if (cleared) notifySessionChanged(slot);
  }
  if (pathToSlot(currentRoutePath()) === slot) {
    // Hash history: the login route is `/#/login`, not `/login`.
    const useHash = window.location.hash.startsWith("#/") || window.location.pathname === "/";
    window.location.assign(useHash ? `${window.location.pathname}#${LOGIN}` : LOGIN);
  }
}

async function throwApiError(
  res: { status: number; statusText: string; json: () => Promise<unknown> },
  path: string,
  slot: PortalSlot | null,
  token: string | null,
): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401 && path !== LOGIN_PATH) {
    handleUnauthorized(slot, token);
  }
  throw new ApiError(res.status, body.error ?? res.statusText);
}

export async function apiFetch<T>(path: string, init?: RequestInit, slot?: PortalSlot): Promise<T> {
  const resolvedSlot =
    slot ?? (typeof window !== "undefined" ? pathToSlot(currentRoutePath()) : null);
  const token = resolvedSlot ? getTokenForSlot(resolvedSlot) : null;

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await ajax(`${API_BASE}${path}`, {
    method: init?.method,
    headers,
    body: init?.body,
    signal: init?.signal ?? undefined,
  });
  if (!res.ok) {
    await throwApiError(res, path, resolvedSlot, token);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiFetchBlob(
  path: string,
  init?: RequestInit,
  slot?: PortalSlot,
): Promise<Blob> {
  const resolvedSlot =
    slot ?? (typeof window !== "undefined" ? pathToSlot(currentRoutePath()) : null);
  const token = resolvedSlot ? getTokenForSlot(resolvedSlot) : null;

  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await ajax(`${API_BASE}${path}`, {
    method: init?.method,
    headers,
    body: init?.body,
    signal: init?.signal ?? undefined,
  });
  if (!res.ok) {
    await throwApiError(res, path, resolvedSlot, token);
  }
  return res.blob();
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: ApiUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (slot: PortalSlot) => apiFetch<{ user: ApiUser }>("/api/auth/me", undefined, slot),

  requesterProfile: (slot?: PortalSlot) =>
    apiFetch<{
      found: boolean;
      source: string;
      profile: {
        name: string;
        email: string;
        division: string;
        designation: string;
        firstName: string;
        middleName: string;
        lastName: string;
      };
      values: Record<string, string>;
    }>("/api/auth/requester-profile", undefined, slot),

  updateProfile: (body: { name: string; division: string; designation?: string }) =>
    apiFetch<{ user: ApiUser }>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Forms (Admin)
  createForm: (body: object) =>
    apiFetch<{ form: FormRecord }>("/api/forms", { method: "POST", body: JSON.stringify(body) }),
  myForms: () => apiFetch<{ items: FormRecord[] }>("/api/forms/mine"),
  myFormsAnalytics: () => apiFetch<MyFormsAnalytics>("/api/forms/mine/analytics"),
  getForm: (id: string) => apiFetch<{ form: FormRecord }>(`/api/forms/${id}`),
  listActionOfficerStaff: () =>
    apiFetch<{
      users: Array<{ _id: string; name: string; email: string; division: string }>;
      sectionId: string;
      sectionName: string;
    }>("/api/forms/action-officer-staff", undefined, "admin"),
  submitFormForReview: (id: string) =>
    apiFetch<{ form: FormRecord }>(`/api/forms/${id}/submit-for-review`, { method: "POST" }),
  createAndSubmitForm: (body: object) =>
    apiFetch<{ form: FormRecord }>("/api/forms/submit-to-records", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Published forms (Client)
  publishedForms: () =>
    apiFetch<{ items: FormRecord[] }>("/api/forms/published", undefined, "client"),
  getPublishedForm: (id: string) =>
    apiFetch<{ form: FormRecord }>(`/api/forms/published/${id}`, undefined, "client"),
  getPublishedFormDocument: (id: string) => apiFetchBlob(`/api/forms/published/${id}/document.pdf`),

  // Records — form review
  recordsDashboard: () =>
    apiFetch<{
      pendingCount: number;
      publishedCount: number;
      recentPending: FormRecord[];
      recentPublished: FormRecord[];
      activities: ActivityRecord[];
    }>("/api/records/dashboard"),
  recordsForms: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<{ items: FormRecord[]; total: number; pendingCount: number }>(
      `/api/records/forms${q ? `?${q}` : ""}`,
    );
  },
  getRecordsForm: (id: string) => apiFetch<{ form: FormRecord }>(`/api/records/forms/${id}`),
  getRecordsFormDocument: (id: string) => apiFetchBlob(`/api/records/forms/${id}/document.pdf`),
  reviewForm: (id: string, body: { decision: FormReviewDecision; remarks?: string }) =>
    apiFetch<{ form: FormRecord }>(`/api/records/forms/${id}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  recordsActivity: (slot?: PortalSlot) =>
    apiFetch<{ items: ActivityRecord[] }>("/api/records/activity", undefined, slot),

  // Tickets
  createTicket: (body: object, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(
      "/api/tickets",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      slot,
    ),
  myTickets: (slot?: PortalSlot) =>
    apiFetch<{ items: TicketRecord[] }>("/api/tickets/mine", undefined, slot),
  listTickets: (params?: Record<string, string>, slot?: PortalSlot) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch<{ items: TicketRecord[]; total: number; pendingCount: number }>(
      `/api/tickets${q ? `?${q}` : ""}`,
      undefined,
      slot,
    );
  },
  listClientReview: (scope: "recommending" | "supervisor" | "action_officer", slot?: PortalSlot) =>
    apiFetch<{
      items: TicketRecord[];
      total: number;
      canReviewRecommending: boolean;
      canReviewSupervisor: boolean;
    }>(`/api/tickets/for-review?scope=${scope}`, undefined, slot),
  getTicket: (id: string, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}`, undefined, slot),
  getTicketDocument: (id: string, slot?: PortalSlot) =>
    apiFetchBlob(`/api/tickets/${id}/document.pdf`, undefined, slot),
  approveTicket: (id: string, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}/approve`, { method: "POST" }, slot),
  rejectTicket: (id: string, reason: string, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(
      `/api/tickets/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
      slot,
    ),
  assignTicket: (id: string, assigneeIds: string[], slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(
      `/api/tickets/${id}/assign`,
      {
        method: "POST",
        body: JSON.stringify({ assigneeIds }),
      },
      slot,
    ),
  listAssignedTickets: (slot?: PortalSlot) =>
    apiFetch<{ items: TicketRecord[] }>(`/api/tickets/assigned/mine`, undefined, slot),
  completeTicketService: (id: string, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}/complete`, { method: "POST" }, slot),
  updateTicketStatus: (id: string, status: TicketStatus, slot?: PortalSlot) =>
    apiFetch<{ ticket: TicketRecord }>(
      `/api/tickets/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
      slot,
    ),
  confirmTicket: (id: string, satisfied: boolean) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ satisfied }),
    }),
  submitFeedback: (id: string, body: { rating?: number; comment?: string }) =>
    apiFetch<{ ticket: TicketRecord }>(`/api/tickets/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listAssignees: (ticketId: string) =>
    apiFetch<{
      users: Array<{ _id: string; name: string; email: string; division: string }>;
      division: string;
    }>(`/api/tickets/assignees?ticketId=${encodeURIComponent(ticketId)}`, undefined, "admin"),
  listAssigneesByDivision: (division: string) =>
    apiFetch<{
      users: Array<{ _id: string; name: string; email: string; division: string }>;
      division: string;
    }>(
      `/api/tickets/assignees?division=${encodeURIComponent(division)}`,
      undefined,
      "admin",
    ),

  superAdminOverview: () =>
    apiFetch<{
      users: {
        total: number;
        superAdmins: number;
        admins: number;
        records: number;
        staff: number;
      };
      forms: {
        draft: number;
        pendingReview: number;
        published: number;
        disapproved: number;
      };
      tickets: {
        pendingApproval: number;
        open: number;
        inProgress: number;
        pending: number;
        resolved: number;
        closed: number;
        reopened: number;
        rejected: number;
      };
      recentActivities: ActivityRecord[];
    }>("/api/super-admin/overview", undefined, "admin"),

  listMessageableUsers: (slot?: PortalSlot) =>
    apiFetch<{ users: MessageableUser[] }>("/api/messages/users", undefined, slot),
  listConversations: (slot?: PortalSlot) =>
    apiFetch<{ items: ConversationRecord[] }>("/api/messages/conversations", undefined, slot),
  getTicketConversation: (ticketId: string, slot?: PortalSlot) =>
    apiFetch<{ conversation: ConversationRecord }>(
      `/api/messages/conversations/ticket/${ticketId}`,
      undefined,
      slot,
    ),
  listMentionableUsers: (conversationId: string, slot?: PortalSlot) =>
    apiFetch<{ users: MessageableUser[] }>(
      `/api/messages/conversations/${conversationId}/mentionable`,
      undefined,
      slot,
    ),
  startDirectConversation: (userId: string, slot?: PortalSlot) =>
    apiFetch<{ conversation: ConversationRecord }>(
      "/api/messages/conversations/direct",
      { method: "POST", body: JSON.stringify({ userId }) },
      slot,
    ),
  listConversationMessages: (conversationId: string, slot?: PortalSlot) =>
    apiFetch<{ items: ConversationMessageRecord[] }>(
      `/api/messages/conversations/${conversationId}/messages`,
      undefined,
      slot,
    ),
  postConversationMessage: (
    conversationId: string,
    body: string,
    slot?: PortalSlot,
    mentionIds?: string[],
  ) =>
    apiFetch<{ message: ConversationMessageRecord }>(
      `/api/messages/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body, mentionIds: mentionIds ?? [] }),
      },
      slot,
    ),
  pokeUser: (userId: string, slot?: PortalSlot) =>
    apiFetch<{ poke: PokeRecord }>(
      "/api/messages/poke",
      { method: "POST", body: JSON.stringify({ userId }) },
      slot,
    ),
  listRecentPokes: (slot?: PortalSlot) =>
    apiFetch<{ items: PokeRecord[] }>("/api/messages/pokes/recent", undefined, slot),

  rbacSummary: () => apiFetch<RbacSummary>("/api/rbac/summary", undefined, "admin"),
  rbacRoles: () => apiFetch<{ items: RbacRole[] }>("/api/rbac/roles", undefined, "admin"),
  rbacPermissions: () =>
    apiFetch<{ items: RbacPermission[] }>("/api/rbac/permissions", undefined, "admin"),
  rbacCreateRole: (body: { name: string; description?: string }) =>
    apiFetch<{ role: RbacRole }>(
      "/api/rbac/roles",
      { method: "POST", body: JSON.stringify(body) },
      "admin",
    ),
  rbacUpdateRole: (roleId: number, body: { description?: string | null }) =>
    apiFetch<{ role: RbacRole }>(
      `/api/rbac/roles/${roleId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      "admin",
    ),
  rbacDeleteRole: (roleId: number) =>
    apiFetch<{ ok: boolean }>(`/api/rbac/roles/${roleId}`, { method: "DELETE" }, "admin"),
  rbacSyncRolePermissions: (roleId: number, permissionIds: number[]) =>
    apiFetch<{ role: RbacRole }>(
      `/api/rbac/roles/${roleId}/permissions`,
      { method: "PUT", body: JSON.stringify({ permissionIds }) },
      "admin",
    ),
  rbacEmployees: (params?: {
    search?: string;
    role?: string;
    access?: string;
    page?: number;
    perPage?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.role) q.set("role", params.role);
    if (params?.access) q.set("access", params.access);
    if (params?.page != null) q.set("page", String(params.page));
    if (params?.perPage != null) q.set("perPage", String(params.perPage));
    const qs = q.toString();
    return apiFetch<RbacEmployeesResponse>(
      `/api/rbac/employees${qs ? `?${qs}` : ""}`,
      undefined,
      "admin",
    );
  },
  rbacSyncRoles: (userId: number, roleIds: number[]) =>
    apiFetch<{ employee: RbacEmployee }>(
      `/api/rbac/employees/${userId}/roles`,
      { method: "PUT", body: JSON.stringify({ roleIds }) },
      "admin",
    ),

  uploadFile: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch<{ file: UploadedFileRecord }>("/api/uploads", { method: "POST", body: fd });
  },
};
