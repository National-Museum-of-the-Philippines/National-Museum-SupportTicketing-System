import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { FORM_REVIEW_DECISIONS } from "../constants.js";
import * as formService from "../services/formService.js";
import { listRecentActivities } from "../services/activityService.js";
import { paramId } from "../utils/params.js";

export const recordsRouter = Router();

recordsRouter.use(requireAuth, requireRoles("record_management"));

recordsRouter.get("/dashboard", async (_req, res, next) => {
  try {
    const [pending, published, activities] = await Promise.all([
      formService.listFormsForRecords({ status: "pending_review", limit: 5 }),
      formService.listFormsForRecords({ status: "published", limit: 5 }),
      listRecentActivities(10),
    ]);
    res.json({
      pendingCount: pending.pendingCount,
      publishedCount: published.total,
      recentPending: pending.items,
      recentPublished: published.items,
      activities,
    });
  } catch (e) {
    next(e);
  }
});

recordsRouter.get("/forms", async (req, res, next) => {
  try {
    const data = await formService.listFormsForRecords({
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

recordsRouter.get("/forms/:id/document.pdf", async (req, res, next) => {
  try {
    const form = await formService.getFormById(paramId(req));
    const { generateFormPreviewPdf } = await import("../services/formDocumentService.js");
    const bytes = await generateFormPreviewPdf(paramId(req));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${form.refNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf"`,
    );
    res.send(Buffer.from(bytes));
  } catch (e) {
    next(e);
  }
});

recordsRouter.get("/forms/:id", async (req, res, next) => {
  try {
    const form = await formService.getFormById(paramId(req));
    res.json({ form });
  } catch (e) {
    next(e);
  }
});

const reviewSchema = z.object({
  decision: z.enum(FORM_REVIEW_DECISIONS),
  remarks: z.string().optional(),
});

recordsRouter.post("/forms/:id/review", async (req, res, next) => {
  try {
    const body = reviewSchema.parse(req.body);
    const form = await formService.reviewForm(req.user!, paramId(req), body);
    res.json({ form });
  } catch (e) {
    next(e);
  }
});

recordsRouter.get("/activity", async (req, res, next) => {
  try {
    const items = await listRecentActivities(Number(req.query.limit) || 30);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});
