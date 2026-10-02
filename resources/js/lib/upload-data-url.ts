/** Convert a data URL to a File for upload. */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) {
    throw new Error("Expected a data URL.");
  }
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const mime = /data:([^;,]*)/.exec(meta)?.[1] || "image/png";
  const binary = meta.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const ext = blob.type.split("/")[1] || "png";
  const name = filename.includes(".") ? filename : `${filename}.${ext}`;
  return new File([blob], name, { type: blob.type || "image/png" });
}
