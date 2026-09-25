/** Shared upload rules — PDF only for Form Builder + client submissions. */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_MB = 25;

export const PDF_ACCEPT = "application/pdf,.pdf";

export const TEMPLATE_ACCEPT = PDF_ACCEPT;
export const SUPPORTING_DOC_ACCEPT = PDF_ACCEPT;
export const CLIENT_FILE_FIELD_ACCEPT = PDF_ACCEPT;

export function isPdfName(name: string, mime = ""): boolean {
  return mime === "application/pdf" || /\.pdf$/i.test(name);
}

export function isAllowedUpload(name: string, mime = ""): boolean {
  return isPdfName(name, mime);
}

export function isAllowedPrintTemplate(name: string, mime = ""): boolean {
  return isPdfName(name, mime);
}

export function uploadTooLarge(size: number): boolean {
  return size > MAX_UPLOAD_BYTES;
}
