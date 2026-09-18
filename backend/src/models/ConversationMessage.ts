import type { RowDataPacket } from "mysql2";
import { query, execute } from "../db.js";
import { newId } from "../utils/ids.js";
import { asBool, asDateRequired, parseJson, toJson } from "../utils/sqlJson.js";

export type MessageMention = {
  userId: string;
  userName: string;
};

export type ConversationMessageDoc = {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  mentions: MessageMention[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<ConversationMessageDoc>;
};

type MessageRow = RowDataPacket & {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  mentions: unknown;
  is_system: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MessageFilter = {
  conversationId?: string;
};

export type MessageFindOptions = {
  sort?: Record<string, 1 | -1>;
  limit?: number;
};

function mapRow(row: MessageRow): ConversationMessageDoc {
  const mentionsRaw = parseJson<Array<{ userId?: string; userName?: string }>>(row.mentions, []);
  const doc: ConversationMessageDoc = {
    _id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    body: row.body,
    mentions: mentionsRaw.map((m) => ({
      userId: String(m.userId ?? ""),
      userName: String(m.userName ?? ""),
    })),
    isSystem: asBool(row.is_system),
    createdAt: asDateRequired(row.created_at),
    updatedAt: asDateRequired(row.updated_at),
    async save() {
      await execute(
        `UPDATE conversation_messages SET
          conversation_id = :conversationId, sender_id = :senderId, sender_name = :senderName,
          sender_role = :senderRole, body = :body, mentions = CAST(:mentions AS JSON),
          is_system = :isSystem
         WHERE id = :id`,
        {
          id: doc._id,
          conversationId: doc.conversationId,
          senderId: doc.senderId,
          senderName: doc.senderName,
          senderRole: doc.senderRole,
          body: doc.body,
          mentions: toJson(doc.mentions),
          isSystem: doc.isSystem ? 1 : 0,
        },
      );
      const fresh = await ConversationMessage.findById(doc._id);
      if (!fresh) throw new Error("Message not found after save");
      Object.assign(doc, fresh);
      return doc;
    },
  };
  return doc;
}

function buildWhere(filter: MessageFilter = {}): { sql: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.conversationId !== undefined) {
    clauses.push("conversation_id = :conversationId");
    params.conversationId = filter.conversationId;
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function buildOrder(sort?: Record<string, 1 | -1>): string {
  if (!sort || Object.keys(sort).length === 0) return "ORDER BY created_at ASC";
  const colMap: Record<string, string> = {
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  const parts = Object.entries(sort).map(([key, dir]) => {
    const col = colMap[key] ?? key;
    return `${col} ${dir === -1 ? "DESC" : "ASC"}`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}

export const ConversationMessage = {
  async findById(id: string): Promise<ConversationMessageDoc | null> {
    const rows = await query<MessageRow[]>(
      "SELECT * FROM conversation_messages WHERE id = :id LIMIT 1",
      { id },
    );
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async find(
    filter: MessageFilter = {},
    options: MessageFindOptions = {},
  ): Promise<ConversationMessageDoc[]> {
    const { sql, params } = buildWhere(filter);
    const order = buildOrder(options.sort);
    let limitSql = "";
    if (options.limit != null) limitSql = `LIMIT ${Number(options.limit)}`;
    const rows = await query<MessageRow[]>(
      `SELECT * FROM conversation_messages ${sql} ${order} ${limitSql}`.trim(),
      params,
    );
    return rows.map(mapRow);
  },

  async create(data: {
    conversationId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    body: string;
    mentions?: MessageMention[];
    isSystem?: boolean;
  }): Promise<ConversationMessageDoc> {
    const id = newId();
    const mentions = (data.mentions ?? []).map((m) => ({
      userId: String(typeof m.userId === "object" && m.userId !== null && "_id" in (m.userId as object)
        ? (m.userId as { _id: string })._id
        : m.userId),
      userName: m.userName,
    }));

    await execute(
      `INSERT INTO conversation_messages (
        id, conversation_id, sender_id, sender_name, sender_role, body, mentions, is_system
      ) VALUES (
        :id, :conversationId, :senderId, :senderName, :senderRole, :body, CAST(:mentions AS JSON), :isSystem
      )`,
      {
        id,
        conversationId: data.conversationId,
        senderId: String(data.senderId),
        senderName: data.senderName,
        senderRole: data.senderRole,
        body: data.body,
        mentions: toJson(mentions),
        isSystem: data.isSystem ? 1 : 0,
      },
    );
    const doc = await ConversationMessage.findById(id);
    if (!doc) throw new Error("Failed to create message");
    return doc;
  },
};
