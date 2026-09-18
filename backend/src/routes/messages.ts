import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import * as conversationService from "../services/conversationService.js";
import * as pokeService from "../services/pokeService.js";
import { paramId } from "../utils/params.js";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);
messagesRouter.use(requireRoles("admin", "user"));

messagesRouter.get("/users", async (req, res, next) => {
  try {
    const users = await conversationService.listMessageableUsers(req.user!);
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

messagesRouter.get("/conversations", async (req, res, next) => {
  try {
    const items = await conversationService.listConversations(req.user!);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

messagesRouter.post("/conversations/direct", async (req, res, next) => {
  try {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body);
    const data = await conversationService.getOrCreateDirectConversation(req.user!, userId);
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

messagesRouter.post("/poke", async (req, res, next) => {
  try {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body);
    const poke = await pokeService.sendPoke(req.user!, userId);
    res.status(201).json({ poke });
  } catch (e) {
    next(e);
  }
});

messagesRouter.get("/pokes/recent", async (req, res, next) => {
  try {
    const items = await pokeService.listRecentPokes(req.user!);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

messagesRouter.get("/conversations/ticket/:ticketId", async (req, res, next) => {
  try {
    const data = await conversationService.getTicketConversation(req.user!, paramId(req, "ticketId"));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

messagesRouter.get("/conversations/:id/mentionable", async (req, res, next) => {
  try {
    const users = await conversationService.listMentionableUsers(req.user!, paramId(req));
    res.json({ users });
  } catch (e) {
    next(e);
  }
});

messagesRouter.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    const items = await conversationService.listConversationMessages(req.user!, paramId(req));
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

messagesRouter.post("/conversations/:id/messages", async (req, res, next) => {
  try {
    const { body, mentionIds } = z
      .object({
        body: z.string().min(1).max(4000),
        mentionIds: z.array(z.string()).optional(),
      })
      .parse(req.body);
    const message = await conversationService.postConversationMessage(
      req.user!,
      paramId(req),
      body,
      mentionIds ?? [],
    );
    res.status(201).json({ message });
  } catch (e) {
    next(e);
  }
});
