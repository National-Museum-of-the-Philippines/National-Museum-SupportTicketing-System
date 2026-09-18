import { Form } from "../models/Form.js";
import type { AuthUser } from "../middleware/auth.js";
import type { FormReviewDecision } from "../constants.js";
import { AppError } from "../utils/errors.js";
import { generateFormRef } from "../utils/ticketNumber.js";
import { normalizeFormFields } from "../utils/formFields.js";
import { logActivity } from "./activityService.js";

function withNormalizedFields<T extends { fields?: unknown }>(form: T): T {
  if (!form || !Array.isArray(form.fields)) return form;
  return { ...form, fields: normalizeFormFields(form.fields as never[]) };
}

function normalizeFormBody(body: Record<string, unknown>) {
  if (!Array.isArray(body.fields)) return body;
  return { ...body, fields: normalizeFormFields(body.fields as never[]) };
}

async function requireForm(id: string) {
  const doc = await Form.findById(id);
  if (!doc) throw new AppError(404, "Form not found");
  return doc;
}

export async function createForm(user: AuthUser, body: Record<string, unknown>) {
  const form = await Form.create({
    ...normalizeFormBody(body),
    title: String(body.title ?? ""),
    refNumber: (body.refNumber as string | undefined) ?? generateFormRef(),
    status: "draft",
    createdBy: user.id,
    updatedBy: user.id,
  });
  await logActivity(user, {
    action: "form_created",
    entityType: "form",
    entityId: form._id.toString(),
    summary: `Form "${form.title}" created as draft`,
  });
  return form;
}

export async function updateForm(user: AuthUser, formId: string, body: Record<string, unknown>) {
  const form = await requireForm(formId);
  if (!["draft", "disapproved"].includes(form.status)) {
    throw new AppError(400, "Only draft or disapproved forms can be edited");
  }
  Object.assign(form, normalizeFormBody(body), { updatedBy: user.id });
  await form.save();
  return form;
}

export async function listMyForms(user: AuthUser) {
  return Form.find({ createdBy: user.id }, { sort: { updatedAt: -1 } });
}

export async function getFormById(id: string) {
  const form = await Form.findById(id, { populate: "createdBy" });
  if (!form) throw new AppError(404, "Form not found");
  return withNormalizedFields(form);
}

/** Create form and submit to Records in one step (avoids orphan drafts). */
export async function createAndSubmitForReview(user: AuthUser, body: Record<string, unknown>) {
  const templatePath = String(body.printTemplateImagePath ?? "").trim();
  const procedurePath = String(body.workProcedurePath ?? "").trim();
  if (!templatePath && !procedurePath) {
    throw new AppError(400, "Upload a form template before submitting to Records.");
  }
  const form = await createForm(user, body);
  return submitFormForReview(user, form._id.toString());
}

/** Admin submits form to Records — does NOT auto-publish */
export async function submitFormForReview(user: AuthUser, formId: string) {
  const form = await requireForm(formId);
  if (!["draft", "disapproved"].includes(form.status)) {
    throw new AppError(400, "Only draft or disapproved forms can be submitted for review");
  }
  form.status = "pending_review";
  form.submittedForReviewAt = new Date();
  form.reviewRemarks = "";
  form.updatedBy = user.id;
  await form.save();

  await logActivity(user, {
    action: "form_submitted_for_review",
    entityType: "form",
    entityId: form._id.toString(),
    summary: `Form "${form.title}" submitted to Records for review`,
  });
  return form;
}

export async function listFormsForRecords(query: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, query.limit ?? 20);
  const filter: {
    status?: string | { $in: string[] };
    $or?: Array<{ title?: RegExp; department?: RegExp }>;
  } = {};

  if (query.status) filter.status = query.status;
  else filter.status = { $in: ["pending_review", "published", "disapproved"] };

  if (query.search?.trim()) {
    filter.$or = [
      { title: new RegExp(query.search.trim(), "i") },
      { department: new RegExp(query.search.trim(), "i") },
    ];
  }

  const [items, total, pendingCount] = await Promise.all([
    Form.find(filter, {
      sort: { updatedAt: -1 },
      skip: (page - 1) * limit,
      limit,
      populate: "createdBy",
    }),
    Form.countDocuments(filter),
    Form.countDocuments({ status: "pending_review" }),
  ]);

  return { items, total, page, limit, pendingCount };
}

export async function reviewForm(
  reviewer: AuthUser,
  formId: string,
  body: { decision: FormReviewDecision; remarks?: string },
) {
  const existing = await requireForm(formId);

  // Idempotent — double-click or stale tab after a successful review.
  if (existing.status !== "pending_review") {
    if (body.decision === "approved" && existing.status === "published") {
      return existing;
    }
    if (body.decision === "disapproved" && existing.status === "disapproved") {
      return existing;
    }
    const label = existing.status.replace(/_/g, " ");
    throw new AppError(
      400,
      `This form is already ${label}. Go back to Pending Forms and pick another entry.`,
    );
  }

  const nextStatus = body.decision === "approved" ? "published" : "disapproved";
  const reviewRemarks =
    body.decision === "approved"
      ? (body.remarks ?? "")
      : (body.remarks ?? "Please revise and resubmit.");

  const form = await Form.findOneAndUpdate(
    { _id: formId, status: "pending_review" },
    {
      $set: {
        status: nextStatus,
        reviewRemarks,
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
        updatedBy: reviewer.id,
      },
    },
  );

  if (!form) {
    const current = await requireForm(formId);
    if (body.decision === "approved" && current.status === "published") {
      return current;
    }
    if (body.decision === "disapproved" && current.status === "disapproved") {
      return current;
    }
    throw new AppError(400, "This form was just reviewed by another session. Refresh the list.");
  }

  await logActivity(reviewer, {
    action: body.decision === "approved" ? "form_approved" : "form_disapproved",
    entityType: "form",
    entityId: form._id.toString(),
    summary: `Form "${form.title}" ${body.decision} by Records`,
    meta: { remarks: form.reviewRemarks },
  });

  return form;
}

export async function listPublishedForms() {
  const items = await Form.find({ status: "published" }, { sort: { updatedAt: -1 } });
  return items.map((form) => withNormalizedFields(form));
}

export async function getPublishedForm(id: string) {
  const form = await Form.findOne({ _id: id, status: "published" });
  if (!form) throw new AppError(404, "Published form not found");
  return withNormalizedFields(form);
}
