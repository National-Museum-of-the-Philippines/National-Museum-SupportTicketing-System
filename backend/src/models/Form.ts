import type { RowDataPacket } from "mysql2";
import { query, execute } from "../db.js";
import { newId } from "../utils/ids.js";
import { asDate, asDateRequired, parseJson, toJson } from "../utils/sqlJson.js";

export type FormField = {
  id?: string;
  type?: string;
  variable?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
};

export type FormSignatory = {
  id?: string;
  division?: string;
  name?: string;
};

export type FormPlacement = {
  id?: string;
  variable?: string;
  label?: string;
  xPct?: number;
  yPct?: number;
};

export type PopulatedUserRef = {
  _id: string;
  name: string;
  email: string;
  division: string;
};

export type FormDoc = {
  _id: string;
  title: string;
  refNumber: string;
  effectivity: string;
  version: string;
  fields: FormField[];
  signatories: FormSignatory[];
  printTemplate: string;
  printTemplateImagePath: string | null;
  printPlacements: FormPlacement[];
  printPlacementFontSize: number;
  workProcedureName: string;
  workProcedurePath: string | null;
  status: string;
  description: string;
  department: string;
  reviewRemarks: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  submittedForReviewAt: Date | null;
  duplicatedFrom: string | null;
  createdBy: string | PopulatedUserRef;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<FormDoc>;
};

type FormRow = RowDataPacket & {
  id: string;
  title: string;
  ref_number: string;
  effectivity: string;
  version: string;
  fields: unknown;
  signatories: unknown;
  print_template: string;
  print_template_image_path: string | null;
  print_placements: unknown;
  print_placement_font_size: number;
  work_procedure_name: string;
  work_procedure_path: string | null;
  status: string;
  description: string;
  department: string;
  review_remarks: string;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
  submitted_for_review_at: Date | string | null;
  duplicated_from: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  creator_name?: string;
  creator_email?: string;
  creator_division?: string;
};

export type FormFilter = {
  _id?: string | { $in?: string[] };
  createdBy?: string;
  status?: string | { $in?: string[] };
  $or?: Array<{ title?: RegExp; department?: RegExp; refNumber?: RegExp }>;
};

export type FormFindOptions = {
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
  populate?: string | string[];
  select?: string;
};

function mapRow(row: FormRow, populatedCreator?: PopulatedUserRef | null): FormDoc {
  const createdBy: string | PopulatedUserRef =
    populatedCreator ??
    (row.creator_name
      ? {
          _id: row.created_by,
          name: row.creator_name,
          email: row.creator_email ?? "",
          division: row.creator_division ?? "",
        }
      : row.created_by);

  const doc: FormDoc = {
    _id: row.id,
    title: row.title,
    refNumber: row.ref_number,
    effectivity: row.effectivity,
    version: row.version,
    fields: parseJson(row.fields, []),
    signatories: parseJson(row.signatories, []),
    printTemplate: row.print_template ?? "",
    printTemplateImagePath: row.print_template_image_path,
    printPlacements: parseJson(row.print_placements, []),
    printPlacementFontSize: row.print_placement_font_size ?? 10,
    workProcedureName: row.work_procedure_name ?? "",
    workProcedurePath: row.work_procedure_path,
    status: row.status,
    description: row.description ?? "",
    department: row.department ?? "",
    reviewRemarks: row.review_remarks ?? "",
    reviewedBy: row.reviewed_by,
    reviewedAt: asDate(row.reviewed_at),
    submittedForReviewAt: asDate(row.submitted_for_review_at),
    duplicatedFrom: row.duplicated_from,
    createdBy,
    updatedBy: row.updated_by,
    createdAt: asDateRequired(row.created_at),
    updatedAt: asDateRequired(row.updated_at),
    async save() {
      const createdById =
        typeof doc.createdBy === "object" && doc.createdBy !== null
          ? doc.createdBy._id
          : String(doc.createdBy);
      await execute(
        `UPDATE forms SET
          title = :title, ref_number = :refNumber, effectivity = :effectivity, version = :version,
          fields = CAST(:fields AS JSON), signatories = CAST(:signatories AS JSON),
          print_template = :printTemplate, print_template_image_path = :printTemplateImagePath,
          print_placements = CAST(:printPlacements AS JSON),
          print_placement_font_size = :printPlacementFontSize,
          work_procedure_name = :workProcedureName, work_procedure_path = :workProcedurePath,
          status = :status, description = :description, department = :department,
          review_remarks = :reviewRemarks, reviewed_by = :reviewedBy, reviewed_at = :reviewedAt,
          submitted_for_review_at = :submittedForReviewAt, duplicated_from = :duplicatedFrom,
          created_by = :createdBy, updated_by = :updatedBy
         WHERE id = :id`,
        {
          id: doc._id,
          title: doc.title,
          refNumber: doc.refNumber,
          effectivity: doc.effectivity,
          version: doc.version,
          fields: toJson(doc.fields),
          signatories: toJson(doc.signatories),
          printTemplate: doc.printTemplate,
          printTemplateImagePath: doc.printTemplateImagePath,
          printPlacements: toJson(doc.printPlacements),
          printPlacementFontSize: doc.printPlacementFontSize,
          workProcedureName: doc.workProcedureName,
          workProcedurePath: doc.workProcedurePath,
          status: doc.status,
          description: doc.description,
          department: doc.department,
          reviewRemarks: doc.reviewRemarks,
          reviewedBy: doc.reviewedBy,
          reviewedAt: doc.reviewedAt,
          submittedForReviewAt: doc.submittedForReviewAt,
          duplicatedFrom: doc.duplicatedFrom,
          createdBy: createdById,
          updatedBy: doc.updatedBy,
        },
      );
      const fresh = await Form.findById(doc._id);
      if (!fresh) throw new Error("Form not found after save");
      Object.assign(doc, fresh);
      return doc;
    },
  };
  return doc;
}

function wantsPopulateCreatedBy(populate?: string | string[]): boolean {
  if (!populate) return false;
  const list = Array.isArray(populate) ? populate : [populate];
  return list.some((p) => p === "createdBy" || p.startsWith("createdBy"));
}

function buildWhere(filter: FormFilter = {}): { sql: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter._id !== undefined) {
    if (typeof filter._id === "string") {
      clauses.push("f.id = :id");
      params.id = filter._id;
    } else if (filter._id.$in) {
      if (filter._id.$in.length === 0) {
        clauses.push("1 = 0");
      } else {
        const placeholders = filter._id.$in.map((_, i) => `:idIn${i}`);
        filter._id.$in.forEach((id, i) => {
          params[`idIn${i}`] = id;
        });
        clauses.push(`f.id IN (${placeholders.join(", ")})`);
      }
    }
  }

  if (filter.createdBy !== undefined) {
    clauses.push("f.created_by = :createdBy");
    params.createdBy = filter.createdBy;
  }

  if (filter.status !== undefined) {
    if (typeof filter.status === "string") {
      clauses.push("f.status = :status");
      params.status = filter.status;
    } else if (filter.status.$in) {
      if (filter.status.$in.length === 0) {
        clauses.push("1 = 0");
      } else {
        const placeholders = filter.status.$in.map((_, i) => `:statusIn${i}`);
        filter.status.$in.forEach((s, i) => {
          params[`statusIn${i}`] = s;
        });
        clauses.push(`f.status IN (${placeholders.join(", ")})`);
      }
    }
  }

  if (filter.$or?.length) {
    const orParts: string[] = [];
    filter.$or.forEach((cond, i) => {
      if (cond.title instanceof RegExp) {
        orParts.push(`f.title LIKE :orTitle${i}`);
        params[`orTitle${i}`] = `%${cond.title.source.replace(/^\^|\$$/g, "").replace(/\\/g, "")}%`;
      }
      if (cond.department instanceof RegExp) {
        orParts.push(`f.department LIKE :orDept${i}`);
        params[`orDept${i}`] = `%${cond.department.source.replace(/^\^|\$$/g, "").replace(/\\/g, "")}%`;
      }
      if (cond.refNumber instanceof RegExp) {
        orParts.push(`f.ref_number LIKE :orRef${i}`);
        params[`orRef${i}`] = `%${cond.refNumber.source.replace(/^\^|\$$/g, "").replace(/\\/g, "")}%`;
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
  if (!sort || Object.keys(sort).length === 0) return "ORDER BY f.updated_at DESC";
  const colMap: Record<string, string> = {
    updatedAt: "f.updated_at",
    createdAt: "f.created_at",
    title: "f.title",
    status: "f.status",
  };
  const parts = Object.entries(sort).map(([key, dir]) => {
    const col = colMap[key] ?? `f.${key}`;
    return `${col} ${dir === -1 ? "DESC" : "ASC"}`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}

async function fetchForms(filter: FormFilter = {}, options: FormFindOptions = {}): Promise<FormDoc[]> {
  const { sql, params } = buildWhere(filter);
  const populateCreator = wantsPopulateCreatedBy(options.populate);
  const join = populateCreator
    ? "LEFT JOIN users u ON u.id = f.created_by"
    : "";
  const selectExtra = populateCreator
    ? ", u.name AS creator_name, u.email AS creator_email, u.division AS creator_division"
    : "";
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

  const rows = await query<FormRow[]>(
    `SELECT f.*${selectExtra} FROM forms f ${join} ${sql} ${order} ${limitSql}`.trim(),
    params,
  );
  return rows.map((row) => mapRow(row));
}

export const Form = {
  async findById(id: string, options: FormFindOptions = {}): Promise<FormDoc | null> {
    const items = await fetchForms({ _id: id }, options);
    return items[0] ?? null;
  },

  async findOne(filter: FormFilter, options: FormFindOptions = {}): Promise<FormDoc | null> {
    const items = await fetchForms(filter, { ...options, limit: 1 });
    return items[0] ?? null;
  },

  async find(filter: FormFilter = {}, options: FormFindOptions = {}): Promise<FormDoc[]> {
    return fetchForms(filter, options);
  },

  async countDocuments(filter: FormFilter = {}): Promise<number> {
    const { sql, params } = buildWhere(filter);
    const rows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM forms f ${sql}`,
      params,
    );
    return Number(rows[0]?.cnt ?? 0);
  },

  async create(data: Partial<FormDoc> & { title: string; createdBy: string }): Promise<FormDoc> {
    const id = newId();
    const createdById =
      typeof data.createdBy === "object" && data.createdBy !== null
        ? (data.createdBy as PopulatedUserRef)._id
        : String(data.createdBy);

    await execute(
      `INSERT INTO forms (
        id, title, ref_number, effectivity, version, fields, signatories,
        print_template, print_template_image_path, print_placements, print_placement_font_size,
        work_procedure_name, work_procedure_path, status, description, department,
        review_remarks, reviewed_by, reviewed_at, submitted_for_review_at, duplicated_from,
        created_by, updated_by
      ) VALUES (
        :id, :title, :refNumber, :effectivity, :version, CAST(:fields AS JSON), CAST(:signatories AS JSON),
        :printTemplate, :printTemplateImagePath, CAST(:printPlacements AS JSON), :printPlacementFontSize,
        :workProcedureName, :workProcedurePath, :status, :description, :department,
        :reviewRemarks, :reviewedBy, :reviewedAt, :submittedForReviewAt, :duplicatedFrom,
        :createdBy, :updatedBy
      )`,
      {
        id,
        title: data.title,
        refNumber: data.refNumber ?? "",
        effectivity: data.effectivity ?? "",
        version: data.version ?? "v1.0",
        fields: toJson(data.fields ?? []),
        signatories: toJson(data.signatories ?? []),
        printTemplate: data.printTemplate ?? "",
        printTemplateImagePath: data.printTemplateImagePath ?? null,
        printPlacements: toJson(data.printPlacements ?? []),
        printPlacementFontSize: data.printPlacementFontSize ?? 10,
        workProcedureName: data.workProcedureName ?? "",
        workProcedurePath: data.workProcedurePath ?? null,
        status: data.status ?? "draft",
        description: data.description ?? "",
        department: data.department ?? "",
        reviewRemarks: data.reviewRemarks ?? "",
        reviewedBy: data.reviewedBy ?? null,
        reviewedAt: data.reviewedAt ?? null,
        submittedForReviewAt: data.submittedForReviewAt ?? null,
        duplicatedFrom: data.duplicatedFrom ?? null,
        createdBy: createdById,
        updatedBy: data.updatedBy ?? createdById,
      },
    );
    const doc = await Form.findById(id);
    if (!doc) throw new Error("Failed to create form");
    return doc;
  },

  async findOneAndUpdate(
    filter: FormFilter & { _id: string; status?: string },
    update: { $set: Record<string, unknown> },
  ): Promise<FormDoc | null> {
    const existing = await Form.findOne(filter);
    if (!existing) return null;
    Object.assign(existing, update.$set);
    await existing.save();
    return existing;
  },
};
