import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { TICKET_STATUSES } from "../constants.js";
import * as ticketService from "../services/ticketService.js";
import { paramId } from "../utils/params.js";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

// Client: submit request using published form
ticketsRouter.post("/", requireRoles("user"), async (req, res, next) => {
  try {
    const schema = z.object({
      formId: z.string(),
      answers: z.record(z.any()).default({}),
      attachmentUrl: z.string().optional(),
      attachmentName: z.string().optional(),
      attachmentMimeType: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const ticket = await ticketService.createTicketFromClient(req.user!, body.formId, body);
    res.status(201).json({ ticket });
  } catch (e) {
    next(e);
  }
});

// Client: my requests
ticketsRouter.get("/mine", requireRoles("user"), async (req, res, next) => {
  try {
    const items = await ticketService.listTicketsForClient(req.user!.id);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

ticketsRouter.get("/assigned/mine", requireRoles("admin"), async (req, res, next) => {
  try {
    const items = await ticketService.listTicketsAssignedToAdmin(req.user!.id);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// Admin: list all tickets
ticketsRouter.get("/", requireRoles("admin"), async (req, res, next) => {
  try {
    const data = await ticketService.listTicketsForAdmin({
      status: req.query.status as never,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

ticketsRouter.get("/assignees", requireRoles("admin"), async (req, res, next) => {
  try {
    const ticketId = typeof req.query.ticketId === "string" ? req.query.ticketId : undefined;
    const result = await ticketService.listAssignees(ticketId);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

ticketsRouter.get("/:id/document.pdf", async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(paramId(req));
    ticketService.assertTicketAccess(req.user!, ticket);
    const { generateTicketDocumentPdf } = await import("../services/ticketDocumentService.js");
    const bytes = await generateTicketDocumentPdf(paramId(req));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${ticket.ticketNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf"`,
    );
    res.send(Buffer.from(bytes));
  } catch (e) {
    next(e);
  }
});

ticketsRouter.get("/:id", async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(paramId(req));
    ticketService.assertTicketAccess(req.user!, ticket);
    res.json({ ticket });
  } catch (e) {
    next(e);
  }
});

ticketsRouter.post("/:id/approve", requireRoles("admin"), async (req, res, next) => {
  try {
    const ticket = await ticketService.approveTicket(req.user!, paramId(req));
    res.json({ ticket });
  } catch (e) {
    next(e);
  }
});

ticketsRouter.post("/:id/reject", requireRoles("admin"), async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const ticket = await ticketService.rejectTicket(req.user!, paramId(req), reason);
    res.json({ ticket });
  } catch (e) {
    next(e);
  }
});

ticketsRouter.post("/:id/assign", requireRoles("admin"), async (req, res, next) => {
  try {
    const { assigneeIds } = z.object({ assigneeIds: z.array(z.string()).min(1) }).parse(req.body);
    const ticket = await ticketService.assignTicket(req.user!, paramId(req), assigneeIds);
    res.json({ ticket });
  } catch (e) {
    next(e);
  }
});

ticketsRouter.post("/:id/complete", requireRoles("user"), async (req, res, next) => {
  try {
    const ticket = await ticketService.completeTicketService(req.user!, paramId(req));
    res.json({ ticket });
  } catch (e) {
    next(e);
  }
});

ticketsRouter.patch("/:id/status", requireRoles("admin"), async (req, res, next) => {
  try {
    const { status } = z
      .object({ status: z.enum(TICKET_STATUSES) })
      .parse(req.body);
    const ticket = await ticketService.updateTicketStatus(req.user!, paramId(req), status);
    res.json({ ticket });
  } catch (e) {
    next(e);
  }
});

ticketsRouter.post("/:id/confirm", requireRoles("user"), async (req, res, next) => {
  try {
    const { satisfied } = z.object({ satisfied: z.boolean() }).parse(req.body);
    const ticket = await ticketService.clientConfirmResolution(req.user!, paramId(req), satisfied);
    res.json({ ticket });
  } catch (e) {
    next(e);
  }
});

ticketsRouter.post("/:id/feedback", requireRoles("user"), async (req, res, next) => {
  try {
    const body = z
      .object({
        rating: z.number().min(1).max(5).optional(),
        comment: z.string().optional(),
      })
      .parse(req.body);
    const ticket = await ticketService.submitFeedback(req.user!, paramId(req), body);
    res.json({ ticket });
  } catch (e) {
    next(e);
  }
});
