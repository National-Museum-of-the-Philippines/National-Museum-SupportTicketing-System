import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { config } from "../config.js";
import { User } from "../models/User.js";
import type { AuthUser } from "../middleware/auth.js";
import { Conversation } from "../models/Conversation.js";

let io: Server | null = null;

export type RealtimeMessagePayload = {
  conversationId: string;
  message: {
    _id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    body: string;
    mentions: Array<{ userId: string; userName: string }>;
    isSystem?: boolean;
    createdAt: string;
  };
};

export type RealtimeMentionPayload = {
  _id: string;
  conversationId: string;
  messageId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: string;
  toUserId: string;
  preview: string;
  createdAt: string;
};

export type RealtimeConversationPayload = {
  conversationId: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderName: string;
};

export type RealtimePokePayload = {
  _id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: string;
  toUserId: string;
  conversationId: string | null;
  createdAt: string;
};

async function authenticateSocket(socket: Socket): Promise<AuthUser | null> {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    const user = await User.findById(payload.sub);
    if (!user || !user.active) return null;
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role as AuthUser["role"],
      division: user.division,
    };
  } catch {
    return null;
  }
}

async function joinUserConversationRooms(
  socket: { join: (room: string) => void | Promise<void> },
  user: AuthUser,
) {
  const conversations = await Conversation.find({
    $or: [{ isGlobal: true }, { participantIds: user.id }],
  });

  for (const conv of conversations) {
    if (conv.ticketId) {
      const { canAccessTicketConversation } = await import("../services/ticketConversationService.js");
      const allowed = await canAccessTicketConversation(user, conv.ticketId.toString());
      if (!allowed) continue;
    } else if (!conv.isGlobal) {
      const isParticipant = conv.participantIds.some((id) => id.toString() === user.id);
      if (!isParticipant) continue;
    }
    socket.join(`conv:${conv._id.toString()}`);
  }
}

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    const user = await authenticateSocket(socket);
    if (!user) return next(new Error("Unauthorized"));
    socket.data.user = user;
    next();
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as AuthUser;
    socket.join(`user:${user.id}`);
    await joinUserConversationRooms(socket, user);

    socket.on("join:conversation", async (conversationId: string) => {
      if (!conversationId) return;
      const conv = await Conversation.findById(conversationId);
      if (!conv) return;
      if (conv.isGlobal) {
        socket.join(`conv:${conversationId}`);
        return;
      }
      if (conv.ticketId) {
        const { canAccessTicketConversation } = await import("../services/ticketConversationService.js");
        const allowed = await canAccessTicketConversation(user, conv.ticketId.toString());
        if (allowed) socket.join(`conv:${conversationId}`);
        return;
      }
      const isParticipant = conv.participantIds.some((id) => id.toString() === user.id);
      if (isParticipant) socket.join(`conv:${conversationId}`);
    });
  });

  return io;
}

export async function emitNewMessage(payload: RealtimeMessagePayload) {
  if (!io) return;
  io.to(`conv:${payload.conversationId}`).emit("message:new", payload);

  // Also push to every participant's personal room so open chats update even
  // when conversation-room membership is still catching up.
  try {
    const conv = await Conversation.findById(payload.conversationId);
    if (!conv) return;
    if (conv.isGlobal) {
      io.emit("message:new", payload);
      return;
    }
    for (const id of conv.participantIds ?? []) {
      io.to(`user:${id.toString()}`).emit("message:new", payload);
    }
  } catch {
    if (payload.message.senderId) {
      io.to(`user:${payload.message.senderId}`).emit("message:new", payload);
    }
  }
}

export function emitConversationUpdate(payload: RealtimeConversationPayload) {
  if (!io) return;
  io.to(`conv:${payload.conversationId}`).emit("conversation:update", payload);
}

export function emitPoke(targetUserId: string, payload: RealtimePokePayload) {
  if (!io) return;
  io.to(`user:${targetUserId}`).emit("poke", payload);
}

export function emitMention(targetUserId: string, payload: RealtimeMentionPayload) {
  if (!io) return;
  io.to(`user:${targetUserId}`).emit("mention", payload);
}

export async function refreshUserConversationRooms(userId: string) {
  if (!io) return;
  const user = await User.findById(userId);
  if (!user) return;

  const authUser: AuthUser = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role as AuthUser["role"],
    division: user.division,
  };

  const sockets = await io.in(`user:${userId}`).fetchSockets();
  for (const socket of sockets) {
    await joinUserConversationRooms(socket, authUser);
  }
}
