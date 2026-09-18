import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import * as formService from "../services/formService.js";
import { paramId } from "../utils/params.js";

export const formsRouter = Router();

formsRouter.use(requireAuth);

formsRouter.get("/published", async (_req, res, next) => {
  try {
    const items = await formService.listPublishedForms();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

formsRouter.get("/published/:id", async (req, res, next) => {
  try {
    const form = await formService.getPublishedForm(paramId(req));
    res.json({ form });
  } catch (e) {
    next(e);
  }
});

formsRouter.get("/published/:id/document.pdf", async (req, res, next) => {
  try {
    const form = await formService.getPublishedForm(paramId(req));
    const { generateFormPreviewPdf } = await import("../services/formDocumentService.js");
    const bytes = await generateFormPreviewPdf(String(form._id));
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

formsRouter.get("/mine/analytics", requireRoles("admin"), async (req, res, next) => {
  try {
    const { getMyFormsAnalytics } = await import("../services/myFormsAnalyticsService.js");
    const analytics = await getMyFormsAnalytics(req.user!);
    res.json(analytics);
  } catch (e) {
    next(e);
  }
});

formsRouter.get("/mine", requireRoles("admin"), async (req, res, next) => {
  try {
    const items = await formService.listMyForms(req.user!);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

formsRouter.get("/:id", requireRoles("admin", "record_management"), async (req, res, next) => {
  try {
    const form = await formService.getFormById(paramId(req));
    res.json({ form });
  } catch (e) {
    next(e);
  }
});

formsRouter.post("/", requireRoles("admin"), async (req, res, next) => {
  try {
    const form = await formService.createForm(req.user!, req.body);
    res.status(201).json({ form });
  } catch (e) {
    next(e);
  }
});

/** Create + submit to Records atomically */
formsRouter.post("/submit-to-records", requireRoles("admin"), async (req, res, next) => {
  try {
    const form = await formService.createAndSubmitForReview(req.user!, req.body);
    res.status(201).json({ form });
  } catch (e) {
    next(e);
  }
});

formsRouter.patch("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const form = await formService.updateForm(req.user!, paramId(req), req.body);
    res.json({ form });
  } catch (e) {
    next(e);
  }
});

formsRouter.post("/:id/submit-for-review", requireRoles("admin"), async (req, res, next) => {
  try {
    const form = await formService.submitFormForReview(req.user!, paramId(req));
    res.json({ form });
  } catch (e) {
    next(e);
  }
});
