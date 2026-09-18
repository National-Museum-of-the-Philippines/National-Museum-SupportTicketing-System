type Pdfjs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<Pdfjs> | null = null;

/** Lazy-load pdf.js only in the browser — never during SSR (DOMMatrix). */
async function getPdfjs(): Promise<Pdfjs> {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering is only available in the browser.");
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** Total rendered height (px) when the PDF is scaled to `displayWidth`. */
export async function getPdfDisplayHeight(blob: Blob, displayWidth: number): Promise<number> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  let totalHeight = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const scale = displayWidth / base.width;
    totalHeight += base.height * scale;
  }

  return Math.ceil(totalHeight);
}

async function renderPdfPageToCanvas(
  page: import("pdfjs-dist").PDFPageProxy,
  maxWidth: number,
): Promise<HTMLCanvasElement> {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2, maxWidth / baseViewport.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas for PDF rendering.");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Renders one PDF page (1-based) to a PNG data URL. */
export async function pdfPageToDataUrl(
  file: File,
  pageNumber: number,
  options?: { maxWidth?: number },
): Promise<{ dataUrl: string; pageCount: number }> {
  const pdfjs = await getPdfjs();
  const maxWidth = options?.maxWidth ?? 1600;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  const safePage = Math.min(Math.max(1, pageNumber), pageCount);
  const page = await doc.getPage(safePage);
  const canvas = await renderPdfPageToCanvas(page, maxWidth);
  return { dataUrl: canvas.toDataURL("image/png"), pageCount };
}

/**
 * Renders every PDF page stacked vertically into one PNG so multi-page forms
 * can receive field placements across the full document.
 */
export async function pdfAllPagesStackedToDataUrl(
  file: File,
  options?: { maxWidth?: number },
): Promise<{ dataUrl: string; pageCount: number }> {
  const pdfjs = await getPdfjs();
  const maxWidth = options?.maxWidth ?? 1600;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  const pageCanvases: HTMLCanvasElement[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    pageCanvases.push(await renderPdfPageToCanvas(page, maxWidth));
  }

  const width = Math.max(...pageCanvases.map((c) => c.width), 1);
  const height = pageCanvases.reduce((sum, c) => sum + c.height, 0);
  const stacked = document.createElement("canvas");
  stacked.width = width;
  stacked.height = height;
  const ctx = stacked.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas for PDF rendering.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const pageCanvas of pageCanvases) {
    const x = Math.floor((width - pageCanvas.width) / 2);
    ctx.drawImage(pageCanvas, x, y);
    y += pageCanvas.height;
  }

  return { dataUrl: stacked.toDataURL("image/png"), pageCount };
}

/** Renders every page of a PDF blob stacked into one PNG (matches Form Builder placements). */
export async function pdfBlobAllPagesStackedToDataUrl(
  blob: Blob,
  options?: { maxWidth?: number },
): Promise<{ dataUrl: string; pageCount: number }> {
  const file = new File([blob], "document.pdf", { type: blob.type || "application/pdf" });
  return pdfAllPagesStackedToDataUrl(file, options);
}

/** Renders the first page of a PDF to a PNG data URL for the print canvas. */
export async function pdfFirstPageToDataUrl(
  file: File,
  options?: { maxWidth?: number },
): Promise<{ dataUrl: string; pageCount: number }> {
  return pdfPageToDataUrl(file, 1, options);
}

/** Renders the first page of a PDF blob to a PNG data URL for overlay previews. */
export async function pdfBlobFirstPageToDataUrl(
  blob: Blob,
  options?: { maxWidth?: number },
): Promise<{ dataUrl: string; pageCount: number }> {
  const file = new File([blob], "document.pdf", { type: blob.type || "application/pdf" });
  return pdfFirstPageToDataUrl(file, options);
}

/** Renders every page of a PDF blob to PNG data URLs (filled ticket docs). */
export async function pdfBlobAllPagesToDataUrls(
  blob: Blob,
  options?: { maxWidth?: number },
): Promise<{ dataUrls: string[]; pageCount: number }> {
  const pdfjs = await getPdfjs();
  // Higher default width keeps glyph spacing even when zoomed in the viewer.
  const maxWidth = options?.maxWidth ?? 2000;
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const dataUrls: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    // Prefer integer-ish scale for more even character spacing in canvas text.
    const rawScale = Math.min(2.5, maxWidth / baseViewport.width);
    const scale = Math.round(rawScale * 100) / 100;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas for PDF rendering.");

    // Crisp glyphs — avoid fractional smoothing artifacts that look like uneven letters.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    dataUrls.push(canvas.toDataURL("image/png"));
  }

  return { dataUrls, pageCount: doc.numPages };
}
