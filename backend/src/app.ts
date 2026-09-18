import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { formsRouter } from "./routes/forms.js";
import { recordsRouter } from "./routes/records.js";
import { ticketsRouter } from "./routes/tickets.js";
import { messagesRouter } from "./routes/messages.js";
import { uploadsRouter, uploadsStaticPath } from "./routes/uploads.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (origin === config.corsOrigin) return callback(null, true);
        if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
          return callback(null, true);
        }
        if (/^https?:\/\/on-prem\.x-dcb\.net(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        callback(new Error(`CORS blocked for ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(uploadsStaticPath()));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "nmp-ticketing-api" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/forms", formsRouter);
  app.use("/api/records", recordsRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/uploads", uploadsRouter);

  app.use(errorHandler);
  return app;
}
