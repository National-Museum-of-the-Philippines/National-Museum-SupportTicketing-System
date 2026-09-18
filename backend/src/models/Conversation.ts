import type { RowDataPacket } from "mysql2";
import { query, execute, getPool } from "../db.js";
import { newId } from "../utils/ids.js";
import { asBool, asDate, asDateRequired } from "../utils/sqlJson.js";

export type ConversationDoc = {
  _id: string;
  type: "direct" | "group" | "ticket" | string;
  participantIds: string[];
  directKey: string | null;
  ticketId: string | null;
  isClosed: boolean;
  closedAt: Date | null;
  title: string;
  isGlobal: boolean;
  lastMessageAt: Date | null;
  lastMessagePreview: string;
  lastSenderName: string;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<ConversationDoc>;
};

type ConversationRow = RowDataPacket & {
  id: string;
  type: string;
  direct_key: string | null;
  ticket_id: string | null;
  is_closed: number | boolean;
  closed_at: Date | string | null;
  title: string;
  is_global: number | boolean;
  last_message_at: Date | string | null;
  last_message_preview: string;
  last_sender_name: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ConversationFilter = {
  _id?: string;
  isGlobal?: boolean;
  ticketId?: string;
  directKey?: string;
  participantIds?: string;
  $or?: Array<{ isGlobal?: boolean; participantIds?: string }>;
};

export type ConversationFindOptions = {
  sort?: Record<string, 1 | -1>;
  select?: string;
  limit?: number;
};

async function loadParticipantIds(conversationId: string): Promise<string[]> {
  const rows = await query<RowDataPacket[]>(
    "SELECT user_id FROM conversation_participants WHERE conversation_id = :id",
    { id: conversationId },
  );
  return rows.map((r) => String(r.user_id));
}

async function replaceParticipants(conversationId: string, userIds: string[]): Promise<void> {
  await execute("DELETE FROM conversation_participants WHERE conversation_id = :id", {
    id: conversationId,
  });
  for (const userId of userIds) {
    await execute(
      "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (:cid, :uid)",
      { cid: conversationId, uid: userId },
    );
  }
}

function mapRow(row: ConversationRow, participantIds: string[]): ConversationDoc {
  const doc: ConversationDoc = {
    _id: row.id,
    type: row.type,
    participantIds,
    directKey: row.direct_key,
    ticketId: row.ticket_id,
    isClosed: asBool(row.is_closed),
    closedAt: asDate(row.closed_at),
    title: row.title ?? "",
    isGlobal: asBool(row.is_global),
    lastMessageAt: asDate(row.last_message_at),
    lastMessagePreview: row.last_message_preview ?? "",
    lastSenderName: row.last_sender_name ?? "",
    createdAt: asDateRequired(row.created_at),
    updatedAt: asDateRequired(row.updated_at),
    async save() {
      await execute(
        `UPDATE conversations SET
          type = :type, direct_key = :directKey, ticket_id = :ticketId,
          is_closed = :isClosed, closed_at = :closedAt, title = :title, is_global = :isGlobal,
          last_message_at = :lastMessageAt, last_message_preview = :lastMessagePreview,
          last_sender_name = :lastSenderName
         WHERE id = :id`,
        {
          id: doc._id,
          type: doc.type,
          directKey: doc.directKey,
          ticketId: doc.ticketId,
          isClosed: doc.isClosed ? 1 : 0,
          closedAt: doc.closedAt,
          title: doc.title,
          isGlobal: doc.isGlobal ? 1 : 0,
          lastMessageAt: doc.lastMessageAt,
          lastMessagePreview: doc.lastMessagePreview,
          lastSenderName: doc.lastSenderName,
        },
      );
      await replaceParticipants(doc._id, doc.participantIds);
      const fresh = await Conversation.findById(doc._id);
      if (!fresh) throw new Error("Conversation not found after save");
      Object.assign(doc, fresh);
      return doc;
    },
  };
  return doc;
}

function buildWhere(
  filter: ConversationFilter = {},
): { sql: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter._id !== undefined) {
    clauses.push("c.id = :id");
    params.id = filter._id;
  }
  if (filter.isGlobal !== undefined) {
    clauses.push("c.is_global = :isGlobal");
    params.isGlobal = filter.isGlobal ? 1 : 0;
  }
  if (filter.ticketId !== undefined) {
    clauses.push("c.ticket_id = :ticketId");
    params.ticketId = filter.ticketId;
  }
  if (filter.directKey !== undefined) {
    clauses.push("c.direct_key = :directKey");
    params.directKey = filter.directKey;
  }
  if (filter.participantIds !== undefined) {
    clauses.push(
      "EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = :participantId)",
    );
    params.participantId = filter.participantIds;
  }

  if (filter.$or?.length) {
    const orParts: string[] = [];
    filter.$or.forEach((cond, i) => {
      if (cond.isGlobal === true) {
        orParts.push("c.is_global = 1");
      }
      if (cond.participantIds !== undefined) {
        orParts.push(
          `EXISTS (SELECT 1 FROM conversation_participants cp${i} WHERE cp${i}.conversation_id = c.id AND cp${i}.user_id = :orParticipant${i})`,
        );
        params[`orParticipant${i}`] = cond.participantIds;
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
  if (!sort || Object.keys(sort).length === 0) {
    return "ORDER BY c.is_global DESC, c.last_message_at DESC, c.updated_at DESC";
  }
  const colMap: Record<string, string> = {
    isGlobal: "c.is_global",
    lastMessageAt: "c.last_message_at",
    updatedAt: "c.updated_at",
    createdAt: "c.created_at",
  };
  const parts = Object.entries(sort).map(([key, dir]) => {
    const col = colMap[key] ?? `c.${key}`;
    return `${col} ${dir === -1 ? "DESC" : "ASC"}`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}

async function fetchConversations(
  filter: ConversationFilter = {},
  options: ConversationFindOptions = {},
): Promise<ConversationDoc[]> {
  const { sql, params } = buildWhere(filter);
  const order = buildOrder(options.sort);
  let limitSql = "";
  if (options.limit != null) {
    limitSql = `LIMIT ${Number(options.limit)}`;
  }

  const rows = await query<ConversationRow[]>(
    `SELECT c.* FROM conversations c ${sql} ${order} ${limitSql}`.trim(),
    params,
  );

  const docs: ConversationDoc[] = [];
  for (const row of rows) {
    const participantIds = await loadParticipantIds(row.id);
    docs.push(mapRow(row, participantIds));
  }
  return docs;
}

export const Conversation = {
  async findById(id: string): Promise<ConversationDoc | null> {
    const items = await fetchConversations({ _id: id }, { limit: 1 });
    return items[0] ?? null;
  },

  async findOne(filter: ConversationFilter): Promise<ConversationDoc | null> {
    const items = await fetchConversations(filter, { limit: 1 });
    return items[0] ?? null;
  },

  async find(
    filter: ConversationFilter = {},
    options: ConversationFindOptions = {},
  ): Promise<ConversationDoc[]> {
    return fetchConversations(filter, options);
  },

  async create(data: {
    type: string;
    participantIds?: string[];
    directKey?: string | null;
    ticketId?: string | null;
    title?: string;
    isGlobal?: boolean;
    isClosed?: boolean;
  }): Promise<ConversationDoc> {
    const id = newId();
    const participantIds = data.participantIds ?? [];
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `INSERT INTO conversations (
          id, type, direct_key, ticket_id, is_closed, title, is_global,
          last_message_preview, last_sender_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '')`,
        [
          id,
          data.type,
          data.directKey ?? null,
          data.ticketId ?? null,
          data.isClosed ? 1 : 0,
          data.title ?? "",
          data.isGlobal ? 1 : 0,
        ],
      );
      for (const userId of participantIds) {
        await conn.execute(
          "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)",
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
    const doc = await Conversation.findById(id);
    if (!doc) throw new Error("Failed to create conversation");
    return doc;
  },

  async updateOne(
    filter: { _id: string },
    update: { $set: Partial<{
      lastMessageAt: Date;
      lastMessagePreview: string;
      lastSenderName: string;
      isClosed: boolean;
      closedAt: Date | null;
      title: string;
      participantIds: string[];
    }> },
  ): Promise<void> {
    const doc = await Conversation.findById(filter._id);
    if (!doc) return;
    Object.assign(doc, update.$set);
    await doc.save();
  },
};
