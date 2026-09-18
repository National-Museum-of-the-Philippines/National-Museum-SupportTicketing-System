import type { AuthUser } from "../middleware/auth.js";
import { Conversation } from "../models/Conversation.js";
import { ConversationMessage } from "../models/ConversationMessage.js";
import { Ticket } from "../models/Ticket.js";
import { User } from "../models/User.js";
import {
  emitConversationUpdate,
  emitMention,
  emitNewMessage,
  type RealtimeMentionPayload,
} from "../realtime/socket.js";
import { AppError } from "../utils/errors.js";
import { idOf } from "../utils/ids.js";
import {
  canAccessTicketConversation,
  getTicketThreadMentionableUserIds,
  syncTicketConversationParticipants,
} from "./ticketConversationService.js";

const GLOBAL_TITLE = "NMP Team Chat";

function directKeyFor(a: string, b: string) {
  return [a, b].sort().join(":");
}

function serializeUser(u: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
  division: string;
}) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    division: u.division,
  };
}

function serializeMessage(doc: {
  _id: { toString(): string };
  conversationId: { toString(): string };
  senderId: { toString(): string };
  senderName: string;
  senderRole: string;
  body: string;
  mentions?: Array<{ userId: { toString(): string }; userName: string }>;
  isSystem?: boolean;
  createdAt: Date;
}) {
  return {
    _id: doc._id.toString(),
    conversationId: doc.conversationId.toString(),
    senderId: doc.senderId.toString(),
    senderName: doc.senderName,
    senderRole: doc.senderRole,
    body: doc.body,
    mentions: (doc.mentions ?? []).map((m) => ({
      userId: m.userId.toString(),
      userName: m.userName,
    })),
    isSystem: Boolean(doc.isSystem),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function ensureGlobalConversation() {
  let conv = await Conversation.findOne({ isGlobal: true });
  if (!conv) {
    conv = await Conversation.create({
      type: "group",
      title: GLOBAL_TITLE,
      isGlobal: true,
      participantIds: [],
    });
  }
  return conv;
}

async function assertConversationAccess(
  user: AuthUser,
  conversation: {
    isGlobal?: boolean;
    isClosed?: boolean;
    ticketId?: { toString(): string } | null;
    participantIds: Array<{ toString(): string }>;
  },
) {
  if (conversation.isGlobal) return;
  if (conversation.isClosed) throw new AppError(404, "Conversation is closed");

  if (conversation.ticketId) {
    const allowed = await canAccessTicketConversation(user, conversation.ticketId.toString());
    if (allowed) return;
    throw new AppError(403, "You do not have access to this conversation");
  }

  const isParticipant = conversation.participantIds.some((id) => id.toString() === user.id);
  if (!isParticipant) throw new AppError(403, "You do not have access to this conversation");
}

async function getMentionableUserIds(conversation: {
  isGlobal?: boolean;
  isClosed?: boolean;
  ticketId?: { toString(): string } | null;
  participantIds: Array<{ toString(): string }>;
}) {
  if (conversation.isClosed) return [];
  if (conversation.isGlobal) {
    const users = await User.find({ active: true });
    return users.map((u) => u._id.toString());
  }

  const ids = new Set(conversation.participantIds.map((id) => id.toString()));

  if (conversation.ticketId) {
    return getTicketThreadMentionableUserIds(conversation.ticketId.toString());
  }

  return [...ids];
}

export async function listMessageableUsers(user: AuthUser) {
  const filter: { active: boolean; _id: { $ne: string }; role?: { $ne: string } } = {
    active: true,
    _id: { $ne: user.id },
  };
  // Admin/client messaging does not include Records users.
  if (user.role !== "record_management") {
    filter.role = { $ne: "record_management" };
  }

  const users = await User.find(filter, { sort: { role: 1, name: 1 } });
  return users.map((u) => serializeUser(u));
}

export async function listMentionableUsers(user: AuthUser, conversationId: string) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new AppError(404, "Conversation not found");
  await assertConversationAccess(user, conversation);

  const ids = await getMentionableUserIds(conversation);
  const users = await User.find(
    {
      _id: { $in: ids.filter((id) => id !== user.id) },
      active: true,
    },
    { sort: { name: 1 } },
  );

  return users.map((u) => serializeUser(u));
}

export async function listConversations(user: AuthUser) {
  await ensureGlobalConversation();

  if (user.role === "user") {
    const myTickets = await Ticket.find({
      creatorId: user.id,
      status: { $nin: ["rejected"] },
    });
    await Promise.all(myTickets.map((t) => syncTicketConversationParticipants(t._id.toString())));
  } else if (user.role === "record_management") {
    // Records does not participate in request message threads.
  } else if (user.role === "admin") {
    // Sync threads for forms this admin created.
    const formIds = await (
      await import("../models/Form.js")
    ).Form.find({ createdBy: user.id });
    if (formIds.length) {
      const creatorTickets = await Ticket.find({
        formId: { $in: formIds.map((f) => f._id) },
        status: { $nin: ["rejected"] },
      });
      await Promise.all(
        creatorTickets.map((t) => syncTicketConversationParticipants(t._id.toString())),
      );
    }
  }

  const assignedTickets = await Ticket.find({
    assignedTo: user.id,
    status: { $nin: ["rejected"] },
  });
  await Promise.all(
    assignedTickets.map((t) => syncTicketConversationParticipants(t._id.toString())),
  );

  const conversations = await Conversation.find(
    {
      $or: [{ isGlobal: true }, { participantIds: user.id }],
    },
    { sort: { isGlobal: -1, lastMessageAt: -1, updatedAt: -1 } },
  );

  const ticketIds = conversations
    .filter((c) => c.ticketId)
    .map((c) => c.ticketId!.toString());

  const tickets = ticketIds.length
    ? await Ticket.find(
        { _id: { $in: ticketIds } },
        { populate: [{ path: "assignedTo", select: "name" }] },
      )
    : [];
  const ticketMap = new Map(tickets.map((t) => [t._id.toString(), t]));

  const visibleConversations =
    user.role === "user"
      ? conversations.filter((conv) => {
          if (conv.isClosed) return false;
          if (!conv.ticketId) return true;
          const ticket = ticketMap.get(conv.ticketId.toString());
          return idOf(ticket?.creatorId) === user.id;
        })
      : user.role === "record_management"
        ? conversations.filter((conv) => !conv.isClosed && !conv.ticketId)
        : conversations.filter((conv) => !conv.isClosed);

  const otherUserIds = new Set<string>();
  for (const conv of visibleConversations) {
    if (conv.type === "direct") {
      for (const pid of conv.participantIds) {
        const id = pid.toString();
        if (id !== user.id) otherUserIds.add(id);
      }
    }
  }

  const others = otherUserIds.size
    ? await User.find({ _id: { $in: [...otherUserIds] } })
    : [];
  const otherMap = new Map(others.map((u) => [u._id.toString(), serializeUser(u)]));

  return visibleConversations.map((conv) => {
    const base = {
      _id: conv._id.toString(),
      type: conv.type as "direct" | "group" | "ticket",
      title: conv.title,
      isGlobal: Boolean(conv.isGlobal),
      lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: conv.lastMessagePreview ?? "",
      lastSenderName: conv.lastSenderName ?? "",
      ticketId: conv.ticketId?.toString() ?? null,
    };

    if (conv.isGlobal) {
      return { ...base, title: GLOBAL_TITLE, subtitle: "Admin, Records & Clients" };
    }

    if (conv.ticketId) {
      const ticket = ticketMap.get(conv.ticketId.toString());
      const assignees = (ticket?.assignedTo as Array<{ name: string }> | undefined) ?? [];
      return {
        ...base,
        type: "ticket" as const,
        title: ticket?.ticketNumber ?? conv.title,
        subtitle: ticket
          ? `Client: ${ticket.creatorName} · Assigned: ${assignees.length ? assignees.map((a) => a.name).join(", ") : "Awaiting assignment"}`
          : "Request thread",
        threadParticipants: "Admin, client & assigned personnel",
        ticketStatus: ticket?.status ?? null,
        ticketTitle: ticket?.title ?? "",
      };
    }

    if (conv.type === "direct") {
      const otherId = conv.participantIds.map((id) => id.toString()).find((id) => id !== user.id);
      const other = otherId ? otherMap.get(otherId) : null;
      return {
        ...base,
        title: other?.name ?? "Direct chat",
        subtitle: other
          ? `${other.role === "admin" ? "Admin" : other.role === "record_management" ? "Records" : "Client"} · ${other.division}`
          : "",
        otherUser: other,
      };
    }

    return { ...base, subtitle: `${conv.participantIds.length} members` };
  });
}

export async function getOrCreateDirectConversation(user: AuthUser, otherUserId: string) {
  if (otherUserId === user.id) throw new AppError(400, "Cannot start a chat with yourself");

  const other = await User.findOne({ _id: otherUserId, active: true });
  if (!other) throw new AppError(404, "User not found");

  const key = directKeyFor(user.id, otherUserId);
  let conv = await Conversation.findOne({ directKey: key });
  if (!conv) {
    conv = await Conversation.create({
      type: "direct",
      participantIds: [user.id, otherUserId],
      directKey: key,
    });
  }

  const otherUser = serializeUser(other);
  return {
    conversation: {
      _id: conv._id.toString(),
      type: "direct" as const,
      title: otherUser.name,
      subtitle: `${otherUser.role === "admin" ? "Admin" : otherUser.role === "record_management" ? "Records" : "Client"} · ${otherUser.division}`,
      isGlobal: false,
      ticketId: null,
      otherUser,
    },
  };
}

export async function getTicketConversation(user: AuthUser, ticketId: string) {
  await syncTicketConversationParticipants(ticketId);
  const conv = await Conversation.findOne({ ticketId });
  if (!conv) throw new AppError(404, "Conversation not found");
  if (conv.isClosed) throw new AppError(404, "Conversation is closed");
  await assertConversationAccess(user, conv);

  const ticket = await Ticket.findById(ticketId, {
    populate: [{ path: "assignedTo", select: "name" }],
  });

  const assignees = (ticket?.assignedTo as Array<{ name: string }> | undefined) ?? [];

  return {
    conversation: {
      _id: conv._id.toString(),
      type: "ticket" as const,
      title: ticket?.ticketNumber ?? conv.title,
      subtitle: ticket
        ? `Client: ${ticket.creatorName} · Assigned: ${assignees.length ? assignees.map((a) => a.name).join(", ") : "Awaiting assignment"}`
        : "Request thread",
      threadParticipants: "Admin, client & assigned personnel",
      isGlobal: false,
      ticketId,
      ticketStatus: ticket?.status ?? null,
      ticketTitle: ticket?.title ?? "",
    },
  };
}

export async function listConversationMessages(user: AuthUser, conversationId: string) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new AppError(404, "Conversation not found");
  await assertConversationAccess(user, conversation);

  const messages = await ConversationMessage.find(
    { conversationId },
    { sort: { createdAt: 1 } },
  );

  return messages.map((m) => serializeMessage(m));
}

export async function postConversationMessage(
  user: AuthUser,
  conversationId: string,
  body: string,
  mentionIds: string[] = [],
) {
  const trimmed = body.trim();
  if (!trimmed) throw new AppError(400, "Message cannot be empty");
  if (trimmed.length > 4000) throw new AppError(400, "Message is too long (max 4000 characters)");

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new AppError(404, "Conversation not found");
  await assertConversationAccess(user, conversation);
  if (conversation.isClosed) throw new AppError(400, "Conversation is already closed");

  const mentionableIds = new Set(await getMentionableUserIds(conversation));
  const validMentionIds = [...new Set(mentionIds)].filter(
    (id) => id !== user.id && mentionableIds.has(id),
  );

  const mentionUsers = validMentionIds.length
    ? await User.find({ _id: { $in: validMentionIds } })
    : [];

  const mentions = mentionUsers.map((u) => ({
    userId: u._id,
    userName: u.name,
  }));

  const message = await ConversationMessage.create({
    conversationId,
    senderId: user.id,
    senderName: user.name,
    senderRole: user.role,
    body: trimmed,
    mentions,
  });

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessagePreview = trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  conversation.lastSenderName = user.name;
  await conversation.save();

  const serialized = serializeMessage(message);
  emitNewMessage({ conversationId, message: serialized });
  emitConversationUpdate({
    conversationId,
    lastMessageAt: message.createdAt.toISOString(),
    lastMessagePreview: conversation.lastMessagePreview,
    lastSenderName: conversation.lastSenderName,
  });

  for (const mention of serialized.mentions) {
    const payload: RealtimeMentionPayload = {
      _id: `${serialized._id}:${mention.userId}`,
      conversationId,
      messageId: serialized._id,
      fromUserId: user.id,
      fromUserName: user.name,
      fromUserRole: user.role,
      toUserId: mention.userId,
      preview: trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed,
      createdAt: serialized.createdAt,
    };
    emitMention(mention.userId, payload);
  }

  return serialized;
}
