import type { RowDataPacket } from "mysql2";
import { query, execute, getPool } from "../db.js";
import { newId } from "../utils/ids.js";
import { asBool, asDate, asDateRequired, parseJson, toJson } from "../utils/sqlJson.js";
import type { FormDoc, FormField, FormPlacement, PopulatedUserRef } from "./Form.js";

export type AssigneeUser = {
  _id: string;
  name: string;
  email: string;
  division: string;
};

export type TicketDoc = {
  _id: string;
  ticketNumber: string;
  formId: string | Partial<FormDoc>;
  formTitle: string;
  title: string;
  description: string;
  creatorId: string | PopulatedUserRef;
  creatorName: string;
  creatorEmail: string;
  division: string;
  answers: Record<string, unknown>;
  attachmentUrl: string;
  attachmentName: string;
  attachmentMimeType: string;
  status: string;
  priority: string;
  rejectionReason: string;
  assignedTo: string[] | AssigneeUser[];
  feedbackRating: number | null;
  feedbackComment: string;
  feedbackSubmitted: boolean;
  clientConfirmed: boolean;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<TicketDoc>;
  populate(path: string, select?: string): Promise<TicketDoc>;
};

type TicketRow = RowDataPacket & {
  id: string;
  ticket_number: string;
  form_id: string;
  form_title: string;
  title: string;
  description: string;
  creator_id: string;
  creator_name: string;
  creator_email: string;
  division: string;
  answers: unknown;
  attachment_url: string;
  attachment_name: string;
  attachment_mime_type: string;
  status: string;
  priority: string;
  rejection_reason: string;
  feedback_rating: number | null;
  feedback_comment: string;
  feedback_submitted: number | boolean;
  client_confirmed: number | boolean;
  resolved_at: Date | string | null;
  closed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type TicketFilter = {
  _id?: string | { $in?: string[] };
  creatorId?: string;
  formId?: string | { $in?: string[] };
  status?: string | { $in?: string[]; $nin?: string[] };
  assignedTo?: string;
  createdAt?: { $gte?: Date; $lt?: Date };
  $or?: Array<{ title?: RegExp; ticketNumber?: RegExp; creatorName?: RegExp }>;
};

export type TicketFindOptions = {
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
  populate?: Array<{ path: string; select?: string }> | string | string[];
  select?: string;
};

async function loadAssigneeIds(ticketId: string): Promise<string[]> {
  const rows = await query<RowDataPacket[]>(
    "SELECT user_id FROM ticket_assignees WHERE ticket_id = :ticketId",
    { ticketId },
  );
  return rows.map((r) => String(r.user_id));
}

async function loadAssignees(ticketId: string): Promise<AssigneeUser[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT u.id, u.name, u.email, u.division
     FROM ticket_assignees ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.ticket_id = :ticketId
     ORDER BY u.name ASC`,
    { ticketId },
  );
  return rows.map((r) => ({
    _id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    division: String(r.division),
  }));
}

async function replaceAssignees(ticketId: string, userIds: string[]): Promise<void> {
  await execute("DELETE FROM ticket_assignees WHERE ticket_id = :ticketId", { ticketId });
  for (const userId of userIds) {
    await execute(
      "INSERT INTO ticket_assignees (ticket_id, user_id) VALUES (:ticketId, :userId)",
      { ticketId, userId },
    );
  }
}

function assigneeIdsOf(assignedTo: string[] | AssigneeUser[]): string[] {
  return assignedTo.map((a) => (typeof a === "string" ? a : a._id));
}

function creatorIdOf(creatorId: string | PopulatedUserRef): string {
  return typeof creatorId === "object" && creatorId !== null ? creatorId._id : String(creatorId);
}

function formIdOf(formId: string | Partial<FormDoc>): string {
  return typeof formId === "object" && formId !== null && "_id" in formId
    ? String(formId._id)
    : String(formId);
}

function mapRow(row: TicketRow, assignedTo: string[] | AssigneeUser[] = []): TicketDoc {
  const doc: TicketDoc = {
    _id: row.id,
    ticketNumber: row.ticket_number,
    formId: row.form_id,
    formTitle: row.form_title,
    title: row.title,
    description: row.description ?? "",
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    creatorEmail: row.creator_email ?? "",
    division: row.division ?? "",
    answers: parseJson(row.answers, {}),
    attachmentUrl: row.attachment_url ?? "",
    attachmentName: row.attachment_name ?? "",
    attachmentMimeType: row.attachment_mime_type ?? "",
    status: row.status,
    priority: row.priority,
    rejectionReason: row.rejection_reason ?? "",
    assignedTo,
    feedbackRating: row.feedback_rating,
    feedbackComment: row.feedback_comment ?? "",
    feedbackSubmitted: asBool(row.feedback_submitted),
    clientConfirmed: asBool(row.client_confirmed),
    resolvedAt: asDate(row.resolved_at),
    closedAt: asDate(row.closed_at),
    createdAt: asDateRequired(row.created_at),
    updatedAt: asDateRequired(row.updated_at),
    async save() {
      const ids = assigneeIdsOf(doc.assignedTo);
      await execute(
        `UPDATE tickets SET
          ticket_number = :ticketNumber, form_id = :formId, form_title = :formTitle,
          title = :title, description = :description, creator_id = :creatorId,
          creator_name = :creatorName, creator_email = :creatorEmail, division = :division,
          answers = CAST(:answers AS JSON), attachment_url = :attachmentUrl,
          attachment_name = :attachmentName, attachment_mime_type = :attachmentMimeType,
          status = :status, priority = :priority, rejection_reason = :rejectionReason,
          feedback_rating = :feedbackRating, feedback_comment = :feedbackComment,
          feedback_submitted = :feedbackSubmitted, client_confirmed = :clientConfirmed,
          resolved_at = :resolvedAt, closed_at = :closedAt
         WHERE id = :id`,
        {
          id: doc._id,
          ticketNumber: doc.ticketNumber,
          formId: formIdOf(doc.formId),
          formTitle: doc.formTitle,
          title: doc.title,
          description: doc.description,
          creatorId: creatorIdOf(doc.creatorId),
          creatorName: doc.creatorName,
          creatorEmail: doc.creatorEmail,
          division: doc.division,
          answers: toJson(doc.answers),
          attachmentUrl: doc.attachmentUrl,
          attachmentName: doc.attachmentName,
          attachmentMimeType: doc.attachmentMimeType,
          status: doc.status,
          priority: doc.priority,
          rejectionReason: doc.rejectionReason,
          feedbackRating: doc.feedbackRating,
          feedbackComment: doc.feedbackComment,
          feedbackSubmitted: doc.feedbackSubmitted ? 1 : 0,
          clientConfirmed: doc.clientConfirmed ? 1 : 0,
          resolvedAt: doc.resolvedAt,
          closedAt: doc.closedAt,
        },
      );
      await replaceAssignees(doc._id, ids);
      const fresh = await Ticket.findById(doc._id);
      if (!fresh) throw new Error("Ticket not found after save");
      Object.assign(doc, fresh);
      return doc;
    },
    async populate(path: string, _select?: string) {
      if (path === "assignedTo") {
        doc.assignedTo = await loadAssignees(doc._id);
      } else if (path === "creatorId") {
        const rows = await query<RowDataPacket[]>(
          "SELECT id, name, email, division FROM users WHERE id = :id LIMIT 1",
          { id: creatorIdOf(doc.creatorId) },
        );
        if (rows[0]) {
          doc.creatorId = {
            _id: String(rows[0].id),
            name: String(rows[0].name),
            email: String(rows[0].email),
            division: String(rows[0].division),
          };
        }
      } else if (path === "formId") {
        const rows = await query<RowDataPacket[]>(
          `SELECT id, title, ref_number, fields, print_template, print_template_image_path,
                  print_placements, print_placement_font_size, work_procedure_path, work_procedure_name
           FROM forms WHERE id = :id LIMIT 1`,
          { id: formIdOf(doc.formId) },
        );
        if (rows[0]) {
          const r = rows[0];
          doc.formId = {
            _id: String(r.id),
            title: String(r.title),
            refNumber: String(r.ref_number),
            fields: parseJson(r.fields, [] as FormField[]),
            printTemplate: String(r.print_template ?? ""),
            printTemplateImagePath: r.print_template_image_path as string | null,
            printPlacements: parseJson(r.print_placements, [] as FormPlacement[]),
            printPlacementFontSize: Number(r.print_placement_font_size ?? 10),
            workProcedurePath: r.work_procedure_path as string | null,
            workProcedureName: String(r.work_procedure_name ?? ""),
          };
        }
      }
      return doc;
    },
  };
  return doc;
}

function normalizePopulate(
  populate?: TicketFindOptions["populate"],
): Array<{ path: string; select?: string }> {
  if (!populate) return [];
  if (typeof populate === "string") return [{ path: populate }];
  if (Array.isArray(populate)) {
    return populate.map((p) => (typeof p === "string" ? { path: p } : p));
  }
  return [];
}

function buildWhere(filter: TicketFilter = {}): { sql: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter._id !== undefined) {
    if (typeof filter._id === "string") {
      clauses.push("t.id = :id");
      params.id = filter._id;
    } else if (filter._id.$in) {
      if (filter._id.$in.length === 0) {
        clauses.push("1 = 0");
      } else {
        const placeholders = filter._id.$in.map((_, i) => `:idIn${i}`);
        filter._id.$in.forEach((id, i) => {
          params[`idIn${i}`] = id;
        });
        clauses.push(`t.id IN (${placeholders.join(", ")})`);
      }
    }
  }

  if (filter.creatorId !== undefined) {
    clauses.push("t.creator_id = :creatorId");
    params.creatorId = filter.creatorId;
  }

  if (filter.formId !== undefined) {
    if (typeof filter.formId === "string") {
      clauses.push("t.form_id = :formId");
      params.formId = filter.formId;
    } else if (filter.formId.$in) {
      if (filter.formId.$in.length === 0) {
        clauses.push("1 = 0");
      } else {
        const placeholders = filter.formId.$in.map((_, i) => `:formIn${i}`);
        filter.formId.$in.forEach((id, i) => {
          params[`formIn${i}`] = id;
        });
        clauses.push(`t.form_id IN (${placeholders.join(", ")})`);
      }
    }
  }

  if (filter.status !== undefined) {
    if (typeof filter.status === "string") {
      clauses.push("t.status = :status");
      params.status = filter.status;
    } else {
      if (filter.status.$in) {
        if (filter.status.$in.length === 0) {
          clauses.push("1 = 0");
        } else {
          const placeholders = filter.status.$in.map((_, i) => `:statusIn${i}`);
          filter.status.$in.forEach((s, i) => {
            params[`statusIn${i}`] = s;
          });
          clauses.push(`t.status IN (${placeholders.join(", ")})`);
        }
      }
      if (filter.status.$nin) {
        if (filter.status.$nin.length > 0) {
          const placeholders = filter.status.$nin.map((_, i) => `:statusNin${i}`);
          filter.status.$nin.forEach((s, i) => {
            params[`statusNin${i}`] = s;
          });
          clauses.push(`t.status NOT IN (${placeholders.join(", ")})`);
        }
      }
    }
  }

  if (filter.assignedTo !== undefined) {
    clauses.push(
      "EXISTS (SELECT 1 FROM ticket_assignees ta WHERE ta.ticket_id = t.id AND ta.user_id = :assignedTo)",
    );
    params.assignedTo = filter.assignedTo;
  }

  if (filter.createdAt?.$gte) {
    clauses.push("t.created_at >= :createdGte");
    params.createdGte = filter.createdAt.$gte;
  }
  if (filter.createdAt?.$lt) {
    clauses.push("t.created_at < :createdLt");
    params.createdLt = filter.createdAt.$lt;
  }

  if (filter.$or?.length) {
    const orParts: string[] = [];
    filter.$or.forEach((cond, i) => {
      if (cond.title instanceof RegExp) {
        orParts.push(`t.title LIKE :orTitle${i}`);
        params[`orTitle${i}`] = `%${cond.title.source.replace(/^\^|\$$/g, "").replace(/\\/g, "")}%`;
      }
      if (cond.ticketNumber instanceof RegExp) {
        orParts.push(`t.ticket_number LIKE :orNum${i}`);
        params[`orNum${i}`] =
          `%${cond.ticketNumber.source.replace(/^\^|\$$/g, "").replace(/\\/g, "")}%`;
      }
      if (cond.creatorName instanceof RegExp) {
        orParts.push(`t.creator_name LIKE :orCreator${i}`);
        params[`orCreator${i}`] =
          `%${cond.creatorName.source.replace(/^\^|\$$/g, "").replace(/\\/g, "")}%`;
      }
    });
    if (orParts.length) clauses.push(`(${orParts.join(" OR ")})`);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function buildOrder(sort?: Record<string, 1 | -1>): string {
  if (!sort || Object.keys(sort).length === 0) return "ORDER BY t.updated_at DESC";
  const colMap: Record<string, string> = {
    updatedAt: "t.updated_at",
    createdAt: "t.created_at",
    status: "t.status",
    title: "t.title",
  };
  const parts = Object.entries(sort).map(([key, dir]) => {
    const col = colMap[key] ?? `t.${key}`;
    return `${col} ${dir === -1 ? "DESC" : "ASC"}`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}

async function applyPopulates(docs: TicketDoc[], options: TicketFindOptions): Promise<TicketDoc[]> {
  const pops = normalizePopulate(options.populate);
  const wantAssignees = pops.some((p) => p.path === "assignedTo");
  const wantCreator = pops.some((p) => p.path === "creatorId");
  const wantForm = pops.some((p) => p.path === "formId");

  for (const doc of docs) {
    if (wantAssignees) {
      doc.assignedTo = await loadAssignees(doc._id);
    } else if (!Array.isArray(doc.assignedTo) || doc.assignedTo.length === 0) {
      doc.assignedTo = await loadAssigneeIds(doc._id);
    }
    if (wantCreator) await doc.populate("creatorId");
    if (wantForm) await doc.populate("formId");
  }
  return docs;
}

async function fetchTickets(
  filter: TicketFilter = {},
  options: TicketFindOptions = {},
): Promise<TicketDoc[]> {
  const { sql, params } = buildWhere(filter);
  const order = buildOrder(options.sort);
  let limitSql = "";
  if (options.limit != null) {
    if (options.skip != null) {
      limitSql = `LIMIT ${Number(options.skip)}, ${Number(options.limit)}`;
    } else {
      limitSql = `LIMIT ${Number(options.limit)}`;
    }
  } else if (options.skip != null) {
    limitSql = `LIMIT ${Number(options.skip)}, 18446744073709551615`;
  }

  const rows = await query<TicketRow[]>(
    `SELECT t.* FROM tickets t ${sql} ${order} ${limitSql}`.trim(),
    params,
  );
  const docs = rows.map((row) => mapRow(row, []));
  return applyPopulates(docs, options);
}

export async function withAssignees(ticket: TicketDoc): Promise<TicketDoc> {
  ticket.assignedTo = await loadAssignees(ticket._id);
  return ticket;
}

export const Ticket = {
  async findById(id: string, options: TicketFindOptions = {}): Promise<TicketDoc | null> {
    const items = await fetchTickets({ _id: id }, options);
    return items[0] ?? null;
  },

  async findOne(filter: TicketFilter, options: TicketFindOptions = {}): Promise<TicketDoc | null> {
    const items = await fetchTickets(filter, { ...options, limit: 1 });
    return items[0] ?? null;
  },

  async find(filter: TicketFilter = {}, options: TicketFindOptions = {}): Promise<TicketDoc[]> {
    return fetchTickets(filter, options);
  },

  async countDocuments(filter: TicketFilter = {}): Promise<number> {
    const { sql, params } = buildWhere(filter);
    const rows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM tickets t ${sql}`,
      params,
    );
    return Number(rows[0]?.cnt ?? 0);
  },

  async create(data: {
    ticketNumber: string;
    formId: string;
    formTitle: string;
    title: string;
    description?: string;
    creatorId: string;
    creatorName: string;
    creatorEmail?: string;
    division?: string;
    answers?: Record<string, unknown>;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentMimeType?: string;
    status?: string;
    priority?: string;
    assignedTo?: string[];
  }): Promise<TicketDoc> {
    const id = newId();
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `INSERT INTO tickets (
          id, ticket_number, form_id, form_title, title, description,
          creator_id, creator_name, creator_email, division, answers,
          attachment_url, attachment_name, attachment_mime_type, status, priority,
          rejection_reason, feedback_comment
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, CAST(? AS JSON),
          ?, ?, ?, ?, ?,
          '', ''
        )`,
        [
          id,
          data.ticketNumber,
          data.formId,
          data.formTitle,
          data.title,
          data.description ?? "",
          data.creatorId,
          data.creatorName,
          data.creatorEmail ?? "",
          data.division ?? "",
          toJson(data.answers ?? {}),
          data.attachmentUrl ?? "",
          data.attachmentName ?? "",
          data.attachmentMimeType ?? "",
          data.status ?? "pending_approval",
          data.priority ?? "medium",
        ],
      );
      for (const userId of data.assignedTo ?? []) {
        await conn.execute(
          "INSERT INTO ticket_assignees (ticket_id, user_id) VALUES (?, ?)",
          [id, userId],
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    const doc = await Ticket.findById(id);
    if (!doc) throw new Error("Failed to create ticket");
    return doc;
  },
};
