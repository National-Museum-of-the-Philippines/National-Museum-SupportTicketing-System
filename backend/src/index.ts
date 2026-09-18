import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { initRealtime } from "./realtime/socket.js";

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error("");
      console.error(`Port ${config.port} is already in use.`);
      console.error("Another backend is probably already running — that is OK.");
      console.error(`Use: http://on-prem.x-dcb.net:${config.port}/api/health`);
      console.error("Only run ONE backend terminal. Close this window or stop the other process.");
      console.error("");
      process.exit(1);
    }
    throw err;
  });

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`API listening on http://on-prem.x-dcb.net:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
