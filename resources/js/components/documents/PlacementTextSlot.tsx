import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import type { PrintFieldPlacement } from "@/lib/form-builder-store";
import { measureFreeSlot, type TemplateDarkMap } from "@/lib/placement-free-space";
import { cn } from "@/lib/utils";

/**
 * Ink map of the template image under the overlay. Provided by the form page
 * shell; null until the image is analysed (or when it cannot be read).
 */
export const PlacementTemplateContext = createContext<TemplateDarkMap | null>(null);

const SAME_ROW_Y_PCT = 2.5;
const PAGE_RIGHT_PCT = 99.2;
const PAGE_BOTTOM_PCT = 99;
/** Smallest per-field shrink (≈13px at the 16px overlay size) before the text keeps flowing down. */
const MIN_FONT_SCALE = 0.8;
const FONT_SCALE_STEP = 0.05;
/** Without a readable template, only use part of the gap to the next row. */
const BLIND_GAP_SHARE = 0.6;

/** Width as % of form width — stops at the next marker on the same row. */
export function placementSlotWidthPct(
  xPct: number,
  yPct: number,
  placements: PrintFieldPlacement[],
  selfId?: string,
): number {
  let nextX = PAGE_RIGHT_PCT;
  for (const other of placements) {
    if (selfId && other.id === selfId) continue;
    if (Math.abs(other.yPct - yPct) > SAME_ROW_Y_PCT) continue;
    if (other.xPct <= xPct + 0.35) continue;
    nextX = Math.min(nextX, other.xPct);
  }
  return Math.max(3, nextX - xPct - 0.6);
}

type SlotBox = {
  widthPct: number;
  /** Highest point the text may move up to (blank template area only). */
  topPct: number;
  bottomPct: number;
  /** Mapped rows above that share this column — text must stay below them. */
  rowsAbovePct: number[];
};

/** Where one field's text may go: its own cell, never over neighbours. */
function resolveSlotBox(
  placement: PrintFieldPlacement,
  placements: PrintFieldPlacement[],
  map: TemplateDarkMap | null,
): SlotBox {
  const { xPct, yPct } = placement;
  const markerWidthPct = placementSlotWidthPct(xPct, yPct, placements, placement.id);
  const free = map ? measureFreeSlot(map, xPct, yPct, xPct + markerWidthPct) : null;
  const widthPct = free
    ? Math.max(3, Math.min(markerWidthPct, free.rightPct - xPct))
    : markerWidthPct;
  const rightPct = xPct + widthPct;

  let nextRowPct = PAGE_BOTTOM_PCT;
  const rowsAbovePct: number[] = [];
  for (const other of placements) {
    if (other.id === placement.id) continue;
    if (Math.abs(other.yPct - yPct) <= SAME_ROW_Y_PCT) continue;
    const otherRight =
      other.xPct + placementSlotWidthPct(other.xPct, other.yPct, placements, other.id);
    if (other.xPct >= rightPct || otherRight <= xPct) continue;
    if (other.yPct > yPct) nextRowPct = Math.min(nextRowPct, other.yPct - 0.3);
    else rowsAbovePct.push(other.yPct);
  }

  // Squeezed against a neighbouring field: the cell still limits the height.
  const cell = free ?? (map ? measureFreeSlot(map, xPct, yPct, PAGE_RIGHT_PCT) : null);
  if (cell) {
    return {
      widthPct,
      topPct: cell.topPct,
      bottomPct: Math.min(cell.bottomPct, nextRowPct),
      rowsAbovePct,
    };
  }
  return {
    widthPct,
    topPct: yPct,
    bottomPct: yPct + (nextRowPct - yPct) * BLIND_GAP_SHARE,
    rowsAbovePct,
  };
}

/**
 * Wraps the text inside the slot like a word processor: next line when the
 * edge is reached, growing downward. If the cell is too short it first uses the
 * blank space above the mapped point, then shrinks this field only.
 */
function fitSlot(anchor: HTMLElement, inner: HTMLElement, yPct: number, box: SlotBox) {
  inner.style.fontSize = "";
  anchor.style.transform = "";
  anchor.style.maxHeight = "";
  delete anchor.dataset.clipped;
  delete anchor.dataset.overflow;

  const root = anchor.offsetParent as HTMLElement | null;
  const rootHeight = root?.clientHeight ?? 0;
  if (!rootHeight) return;

  const lineHeight = parseFloat(getComputedStyle(inner).lineHeight) || inner.offsetHeight;
  let height = inner.offsetHeight;
  // One line already fits — leave it exactly where it was mapped.
  if (height <= lineHeight * 1.5) return;

  const px = (pct: number) => (pct / 100) * rootHeight;
  const roomBelow = Math.max(lineHeight, px(box.bottomPct - yPct));
  let ceilingPct = box.topPct;
  for (const rowPct of box.rowsAbovePct) {
    ceilingPct = Math.max(ceilingPct, rowPct + ((lineHeight * 1.3) / rootHeight) * 100);
  }
  const roomAbove = Math.max(0, px(yPct - ceilingPct));
  const room = roomBelow + roomAbove;

  let scale = 1;
  while (height > room + 0.5 && scale > MIN_FONT_SCALE + 1e-6) {
    scale = Math.max(MIN_FONT_SCALE, scale - FONT_SCALE_STEP);
    inner.style.fontSize = `calc(var(--dynamic-text-size, 16) * ${scale.toFixed(2)} * 1px)`;
    height = inner.offsetHeight;
  }

  if (height > room + 0.5) {
    // Still too long at the smallest readable size: keep wrapping onto the lines
    // below instead of cutting the answer off. Nothing is clipped or moved up.
    anchor.dataset.overflow = "true";
    return;
  }

  const shiftUp = Math.min(roomAbove, Math.max(0, height - roomBelow));
  if (shiftUp > 0.5) anchor.style.transform = `translateY(-${shiftUp.toFixed(1)}px)`;
}

type PlacementTextSlotProps = {
  placement: PrintFieldPlacement;
  placements: PrintFieldPlacement[];
  text: string;
  title?: string;
  className?: string;
  /** CSS length the text starts after the mapped point (Others blank after its checkbox). */
  inset?: string;
};

/**
 * Shared by the form viewers and the Form Builder: gives a mapped field its
 * blank cell and keeps the text wrapped/fitted inside it as it moves or resizes.
 */
export function usePlacementSlotFit<A extends HTMLElement, I extends HTMLElement>(
  placement: PrintFieldPlacement,
  placements: PrintFieldPlacement[],
) {
  const map = useContext(PlacementTemplateContext);
  const anchorRef = useRef<A>(null);
  const innerRef = useRef<I>(null);

  const box = useMemo(
    () => resolveSlotBox(placement, placements, map),
    [placement, placements, map],
  );
  const boxRef = useRef(box);
  boxRef.current = box;
  const yPct = placement.yPct;
  const yRef = useRef(yPct);
  yRef.current = yPct;

  useLayoutEffect(() => {
    if (anchorRef.current && innerRef.current) {
      fitSlot(anchorRef.current, innerRef.current, yPct, box);
    }
  });

  // Zoom, dialog resize, and late web fonts all change how the text wraps.
  useEffect(() => {
    const anchor = anchorRef.current;
    const root = anchor?.closest(".placement-scale-root") ?? anchor?.offsetParent;
    if (!anchor || !root || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (anchorRef.current && innerRef.current) {
          fitSlot(anchorRef.current, innerRef.current, yRef.current, boxRef.current);
        }
      });
    };
    const observer = new ResizeObserver(refit);
    observer.observe(root);
    // Zoom can change the font size without resizing the form itself.
    if (innerRef.current) observer.observe(innerRef.current);
    void document.fonts?.ready.then(refit).catch(() => undefined);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return { anchorRef, innerRef, box };
}

/** One populated text field on the form overlay — wraps and stays in its cell. */
export function PlacementTextSlot({
  placement,
  placements,
  text,
  title,
  className,
  inset,
}: PlacementTextSlotProps) {
  const { anchorRef, innerRef, box } = usePlacementSlotFit<HTMLSpanElement, HTMLSpanElement>(
    placement,
    placements,
  );
  const yPct = placement.yPct;

  const width = inset ? `calc(${box.widthPct}% - ${inset})` : `${box.widthPct}%`;
  const style: CSSProperties = {
    left: inset ? `calc(${placement.xPct}% + ${inset})` : `${placement.xPct}%`,
    top: `${yPct}%`,
    width,
    maxWidth: width,
    overflow: "visible",
    boxSizing: "border-box",
  };

  return (
    <span
      ref={anchorRef}
      className="dynamic-text-anchor pointer-events-none bg-transparent"
      style={style}
      title={title}
    >
      <span ref={innerRef} className={cn("dynamic-text placement-wrap bg-transparent", className)}>
        {text}
      </span>
    </span>
  );
}
