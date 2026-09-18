import type { AuthUser } from "../middleware/auth.js";
import { Poke } from "../models/Poke.js";
import { User } from "../models/User.js";
import { emitPoke, refreshUserConversationRooms, type RealtimePokePayload } from "../realtime/socket.js";
import { AppError } from "../utils/errors.js";
import { idOf } from "../utils/ids.js";
import { getOrCreateDirectConversation } from "./conversationService.js";

const POKE_COOLDOWN_MS = 30_000;

export async function sendPoke(user: AuthUser, toUserId: string): Promise<RealtimePokePayload> {
  if (toUserId === user.id) throw new AppError(400, "You cannot poke yourself");

  const target = await User.findOne({ _id: toUserId, active: true });
  if (!target) throw new AppError(404, "User not found");

  const recent = await Poke.findOne(
    {
      fromUserId: user.id,
      toUserId,
      createdAt: { $gte: new Date(Date.now() - POKE_COOLDOWN_MS) },
    },
    { sort: { createdAt: -1 } },
  );

  if (recent) {
    throw new AppError(429, "Please wait before poking again");
  }

  const { conversation } = await getOrCreateDirectConversation(user, toUserId);
  await refreshUserConversationRooms(user.id);
  await refreshUserConversationRooms(toUserId);

  const poke = await Poke.create({
    fromUserId: user.id,
    toUserId,
    conversationId: conversation._id,
  });

  const payload: RealtimePokePayload = {
    _id: poke._id.toString(),
    fromUserId: user.id,
    fromUserName: user.name,
    fromUserRole: user.role,
    toUserId,
    conversationId: conversation._id,
    createdAt: poke.createdAt.toISOString(),
  };

  emitPoke(toUserId, payload);
  return payload;
}

export async function listRecentPokes(user: AuthUser, limit = 8) {
  const pokes = await Poke.find(
    { toUserId: user.id },
    {
      sort: { createdAt: -1 },
      limit,
      populate: "fromUserId",
    },
  );

  return pokes.map((p) => {
    const from = p.fromUserId as { _id?: { toString(): string }; name?: string; role?: string } | string | null;
    const fromId = typeof from === "object" && from !== null ? from._id?.toString() : idOf(p.fromUserId);
    const fromName = typeof from === "object" && from !== null ? from.name : undefined;
    const fromRole = typeof from === "object" && from !== null ? from.role : undefined;
    return {
      _id: p._id.toString(),
      fromUserId: fromId ?? idOf(p.fromUserId),
      fromUserName: fromName ?? "Someone",
      fromUserRole: fromRole ?? "",
      toUserId: p.toUserId.toString(),
      conversationId: p.conversationId?.toString() ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  });
}
