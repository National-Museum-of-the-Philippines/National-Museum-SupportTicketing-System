import { useContext, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  PlacementTemplateContext,
  placementSlotWidthPct,
} from "@/components/documents/PlacementTextSlot";
import { ajax } from "@/lib/ajax";
import type { PrintFieldPlacement } from "@/lib/form-builder-store";
import { measureFreeSlot, type TemplateDarkMap } from "@/lib/placement-free-space";

/**
 * The signature pad saves its whole canvas (wide, mostly empty), so the ink
 * ends up tiny when that image is squeezed into the form. Crop to the strokes
 * and let the signature fill the blank signature cell instead.
 */

const SAME_ROW_Y_PCT = 2.5;
const PAGE_BOTTOM_PCT = 99;
/** Widest a signature may get, % of form width. */
const MAX_SIGNATURE_WIDTH_PCT = 34;
/** Without a readable template: space kept above / below the mapped point, % of height. */
const BLIND_ABOVE_PCT = 3.2;
const BLIND_BELOW_PCT = 1.3;
/**
 * A signature never grows past one signature line, even when the template has
 * light-shaded rows with no printed line between them (the blank area would
 * otherwise run through several rows and the ink would cover them).
 */
const MAX_SIGNATURE_HEIGHT_PCT = BLIND_ABOVE_PCT + BLIND_BELOW_PCT;

const croppedCache = new Map<string, Promise<string | null>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("signature image failed to load"));
    img.src = src;
  });
}

/** Data URL of just the inked part of the signature, or null if it cannot be read. */
function cropToInk(source: CanvasImageSource, width: number, height: number): string | null {
  if (!(width > 0) || !(height > 0)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0, p = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, p += 4) {
      if (data[p + 3] < 24) continue;
      // Scanned signatures have a white page behind the ink.
      const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      if (lum > 215) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;

  const pad = 3;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;
  outCtx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

async function cropSignature(src: string): Promise<string | null> {
  try {
    const img = await loadImage(src);
    return cropToInk(img, img.naturalWidth, img.naturalHeight);
  } catch {
    /* Cross-origin image taints the canvas — read the file itself instead. */
  }
  try {
    const response = await ajax(src);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const cropped = cropToInk(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    return cropped;
  } catch {
    return null;
  }
}

function croppedSignature(src: string): Promise<string | null> {
  let pending = croppedCache.get(src);
  if (!pending) {
    pending = cropSignature(src);
    croppedCache.set(src, pending);
  }
  return pending;
}

type SignatureBox = { leftPct: number; topPct: number; widthPct: number; heightPct: number };

/** Blank signature cell around the mapped point; the ink sits on its bottom edge. */
function resolveSignatureBox(
  placement: PrintFieldPlacement,
  placements: PrintFieldPlacement[],
  map: TemplateDarkMap | null,
): SignatureBox {
  const { xPct, yPct } = placement;
  const markerWidthPct = placementSlotWidthPct(xPct, yPct, placements, placement.id);

  let rowBelowPct = PAGE_BOTTOM_PCT;
  let rowAbovePct = 0;
  for (const other of placements) {
    if (other.id === placement.id) continue;
    if (Math.abs(other.yPct - yPct) <= SAME_ROW_Y_PCT) continue;
    if (other.xPct >= xPct + markerWidthPct) continue;
    if (other.yPct > yPct) rowBelowPct = Math.min(rowBelowPct, other.yPct - 0.3);
    else rowAbovePct = Math.max(rowAbovePct, other.yPct + 2.2);
  }

  if (map) {
    // The point is usually mapped right on the signature line — probe a little higher too.
    for (const lift of [0, 1.2, 2.4]) {
      const probeY = yPct - lift;
      if (probeY <= 0) break;
      const free = measureFreeSlot(map, xPct, probeY, xPct + markerWidthPct);
      if (!free) continue;
      // Keep the ink on its own line: bottom stays near the mapped point, height is capped.
      const bottomPct = Math.min(free.bottomPct, rowBelowPct, yPct + BLIND_BELOW_PCT);
      const topPct = Math.max(free.topPct, rowAbovePct, bottomPct - MAX_SIGNATURE_HEIGHT_PCT);
      if (bottomPct - topPct < 1) continue;
      return {
        leftPct: xPct,
        topPct,
        widthPct: Math.min(MAX_SIGNATURE_WIDTH_PCT, free.rightPct - xPct),
        heightPct: bottomPct - topPct,
      };
    }
  }

  const topPct = Math.max(0, rowAbovePct, yPct - BLIND_ABOVE_PCT);
  const bottomPct = Math.min(rowBelowPct, yPct + BLIND_BELOW_PCT);
  return {
    leftPct: xPct,
    topPct,
    widthPct: Math.min(MAX_SIGNATURE_WIDTH_PCT, markerWidthPct),
    heightPct: Math.max(1, bottomPct - topPct),
  };
}

type PlacementSignatureProps = {
  placement: PrintFieldPlacement;
  placements: PrintFieldPlacement[];
  src: string;
};

export function PlacementSignature({ placement, placements, src }: PlacementSignatureProps) {
  const map = useContext(PlacementTemplateContext);
  const [cropped, setCropped] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setCropped(null);
    void croppedSignature(src).then((result) => {
      if (active) setCropped(result);
    });
    return () => {
      active = false;
    };
  }, [src]);

  const box = useMemo(
    () => resolveSignatureBox(placement, placements, map),
    [placement, placements, map],
  );

  const style: CSSProperties = {
    left: `${box.leftPct}%`,
    top: `${box.topPct}%`,
    width: `${box.widthPct}%`,
    height: `${box.heightPct}%`,
    overflow: "hidden",
  };

  return (
    <span
      className="dynamic-text-anchor pointer-events-none bg-transparent"
      style={style}
      title={placement.label}
    >
      <img
        src={cropped ?? src}
        alt={placement.label || "Signature"}
        className="placement-signature-fit"
        draggable={false}
      />
    </span>
  );
}
