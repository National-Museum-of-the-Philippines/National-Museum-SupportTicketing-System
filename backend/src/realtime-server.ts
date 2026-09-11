/**
 * Socket.io sidecar for Laravel API.
 * Listens on REALTIME_PORT (default 4001). Shares JWT_SECRET / MySQL with the API.
 * Internal emit endpoints are protected by REALTIME_INTERNAL_SECRET (or JWT_SECRET).
 */
import "dotenv/config";
import http from "node:http";
import jwt from "jsonwebtoken";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";
import { Server, type Socket } from "socket.io";

const PORT = Number(process.env.REALTIME_PORT ?? 4001);
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production-nmp-ticketing";
const INTERNAL_SECRET =
  process.env.REALTIME_INTERNAL_SECRET ??
  process.env.JWT_SECRET ??
  "change-me-in-production-nmp-ticketing";

const pool: Pool = createPool({
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "2026nmpict",
  database: process.env.MYSQL_DATABASE ?? "nmp_ticketing",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  division: string;
};

type ConversationRow = RowDataPacket & {
  id: string;
  ticket_id: string | null;
  is_global: number | boolean;
};

async function query<T extends RowDataPacket[]>(sql: string, params?: Record<string, unknown>): Promise<T> {
  const [rows] = await pool.query<T>(sql, params as never);
  return rows;
}

async function loadParticipantIds(conversationId: string): Promise<string[]> {
  const rows = await query<RowDataPacket[]>(
    "SELECT user_id FROM conversation_participants WHERE conversation_id = :id",
    { id: conversationId },
  );
  return rows.map((r) => String(r.user_id));
}

async function authenticateSocket(socket: Socket): Promise<AuthUser | null> {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const rows = await query<RowDataPacket[]>(
      "SELECT id, email, name, role, division, active FROM users_ WHERE id = :id LIMIT 1",
      { id: payload.sub },
    );
    const user = rows[0];
    if (!user || !user.active) return null;
    return {
      id: String(user.id),
      email: String(user.email),
      name: String(user.name),
      role: String(user.role),
      division: String(user.division ?? ""),
    };
  } catch {
    return null;
  }
}

async function canAccessTicketConversation(user: AuthUser, ticketId: string): Promise<boolean> {
  const tickets = await query<RowDataPacket[]>(
    "SELECT id, creator_id, form_id FROM tickets WHERE id = :id LIMIT 1",
    { id: ticketId },
  );
  const ticket = tickets[0];
  if (!ticket) return false;
  if (user.role === "record_management") return false;
  if (String(ticket.creator_id) === user.id) return true;

  const assignees = await query<RowDataPacket[]>(
    "SELECT user_id FROM ticket_assignees WHERE ticket_id = :id",
    { id: ticketId },
  );
  if (assignees.some((a) => String(a.user_id) === user.id)) return true;

  if (user.role === "admin") {
    const forms = await query<RowDataPacket[]>(
      "SELECT created_by FROM forms WHERE id = :id LIMIT 1",
      { id: String(ticket.form_id) },
    );
    return forms[0] ? String(forms[0].created_by) === user.id : false;
  }
  return false;
}

async function joinUserConversationRooms(
  socket: { join: (room: string) => void | Promise<void> },
  user: AuthUser,
) {
  const rows = await query<ConversationRow[]>(
    `SELECT c.id, c.ticket_id, c.is_global
     FROM conversations c
     WHERE c.is_global = 1
        OR EXISTS (
          SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = c.id AND cp.user_id = :uid
        )`,
    { uid: user.id },
  );

  for (const conv of rows) {
    const isGlobal = Boolean(conv.is_global);
    if (conv.ticket_id) {
      const allowed = await canAccessTicketConversation(user, String(conv.ticket_id));
      if (!allowed) continue;
    } else if (!isGlobal) {
      const participantIds = await loadParticipantIds(String(conv.id));
      if (!participantIds.includes(user.id)) continue;
    }
    await socket.join(`conv:${conv.id}`);
  }
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function assertInternal(req: http.IncomingMessage): boolean {
  const secret = req.headers["x-internal-secret"];
  return typeof secret === "string" && secret === INTERNAL_SECRET;
}

async function main() {
  await pool.query("SELECT 1");

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";
    if (req.method === "GET" && (url === "/health" || url === "/internal/health")) {
      return sendJson(res, 200, { ok: true, service: "nmp-realtime" });
    }

    if (req.method === "POST" && url.startsWith("/internal/")) {
      if (!assertInternal(req)) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }
      try {
        const body = (await readJsonBody(req)) as Record<string, unknown>;

        if (url === "/internal/emit/message") {
          const conversationId = String(body.conversationId ?? "");
          const payload = body as {
            conversationId: string;
            message: Record<string, unknown>;
          };
          io.to(`conv:${conversationId}`).emit("message:new", payload);
          try {
            const rows = await query<ConversationRow[]>(
              "SELECT id, ticket_id, is_global FROM conversations WHERE id = :id LIMIT 1",
              { id: conversationId },
            );
            const conv = rows[0];
            if (conv) {
              if (Boolean(conv.is_global)) {
                io.emit("message:new", payload);
              } else {
                const participantIds = await loadParticipantIds(conversationId);
                for (const id of participantIds) {
                  io.to(`user:${id}`).emit("message:new", payload);
                }
              }
            }
          } catch {
            const senderId = String((payload.message as { senderId?: string })?.senderId ?? "");
            if (senderId) io.to(`user:${senderId}`).emit("message:new", payload);
          }
          return sendJson(res, 200, { ok: true });
        }

        if (url === "/internal/emit/conversation-update") {
          const conversationId = String(body.conversationId ?? "");
          io.to(`conv:${conversationId}`).emit("conversation:update", body);
          return sendJson(res, 200, { ok: true });
        }

        if (url === "/internal/emit/poke") {
          const targetUserId = String(body.targetUserId ?? "");
          io.to(`user:${targetUserId}`).emit("poke", body.payload);
          return sendJson(res, 200, { ok: true });
        }

        if (url === "/internal/emit/mention") {
          const targetUserId = String(body.targetUserId ?? "");
          io.to(`user:${targetUserId}`).emit("mention", body.payload);
          return sendJson(res, 200, { ok: true });
        }

        if (url === "/internal/emit/notification") {
          const payload = (body.payload ?? body) as Record<string, unknown>;
          const userIds = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
          const roles = Array.isArray(body.roles) ? body.roles.map(String) : [];
          for (const id of userIds) {
            if (id) io.to(`user:${id}`).emit("notification", payload);
          }
          for (const role of roles) {
            if (role) io.to(`role:${role}`).emit("notification", payload);
          }
          return sendJson(res, 200, { ok: true });
        }

        if (url === "/internal/refresh-rooms") {
          const userId = String(body.userId ?? "");
          const users = await query<RowDataPacket[]>(
            "SELECT id, email, name, role, division FROM users_ WHERE id = :id LIMIT 1",
            { id: userId },
          );
          const u = users[0];
          if (u) {
            const authUser: AuthUser = {
              id: String(u.id),
              email: String(u.email),
              name: String(u.name),
              role: String(u.role),
              division: String(u.division ?? ""),
            };
            const sockets = await io.in(`user:${userId}`).fetchSockets();
            for (const socket of sockets) {
              socket.join(`role:${authUser.role}`);
              if (authUser.role === "super_admin") {
                socket.join("role:admin");
                socket.join("role:record_management");
              }
              await joinUserConversationRooms(socket, authUser);
            }
          }
          return sendJson(res, 200, { ok: true });
        }

        return sendJson(res, 404, { error: "Not found" });
      } catch (e) {
        console.error(e);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    sendJson(res, 404, { error: "Not found" });
  });

  const io = new Server(server, {
    cors: { origin: true, credentials: true },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    const user = await authenticateSocket(socket);
    if (!user) return next(new Error("Unauthorized"));
    socket.data.user = user;
    next();
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as AuthUser;
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    if (user.role === "super_admin") {
      socket.join("role:admin");
      socket.join("role:record_management");
    }
    await joinUserConversationRooms(socket, user);

    socket.on("join:conversation", async (conversationId: string) => {
      if (!conversationId) return;
      const rows = await query<ConversationRow[]>(
        "SELECT id, ticket_id, is_global FROM conversations WHERE id = :id LIMIT 1",
        { id: conversationId },
      );
      const conv = rows[0];
      if (!conv) return;
      if (Boolean(conv.is_global)) {
        socket.join(`conv:${conversationId}`);
        return;
      }
      if (conv.ticket_id) {
        const allowed = await canAccessTicketConversation(user, String(conv.ticket_id));
        if (allowed) socket.join(`conv:${conversationId}`);
        return;
      }
      const participantIds = await loadParticipantIds(conversationId);
      if (participantIds.includes(user.id)) socket.join(`conv:${conversationId}`);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Realtime sidecar listening on http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
