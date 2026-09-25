import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";

/** Copy an uploaded file onto local disk so the PDF worker can read it. */
export async function materializeUpload(urlPath: string): Promise<string | null> {
  if (!urlPath || urlPath.startsWith("data:")) return null;

  const filename = path.basename(urlPath.split("?")[0] ?? "");
  if (!filename || filename === "." || filename === ".." || filename.includes("..")) {
    return null;
  }

  const local = path.join(config.uploadDir, filename);
  if (fs.existsSync(local)) return local;

  const fetchUrl =
    urlPath.startsWith("http://") || urlPath.startsWith("https://")
      ? urlPath
      : fetchBase(filename);
  if (!fetchUrl) return null;

  const response = await fetch(fetchUrl);
  if (!response.ok) return null;

  const dest = path.join(os.tmpdir(), `nmp-upload-${filename}`);
  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return dest;
}

function fetchBase(filename: string): string | null {
  const base = (process.env.NMP_UPLOAD_FETCH_BASE ?? process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/uploads/${encodeURIComponent(filename)}`;
}
