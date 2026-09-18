import { EmptyState, PanelLoading } from "@/components/layout/workspace-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { placementCanvasStyle } from "@/components/documents/buildPlacementOverlay";
import { DEFAULT_PRINT_PLACEMENT_FONT_SIZE } from "@/lib/form-builder-store";
import { isImagePath, isPdfPath, resolveMediaUrl } from "@/lib/media-url";
import {
  pdfBlobAllPagesStackedToDataUrl,
  pdfBlobAllPagesToDataUrls,
} from "@/lib/pdf-template";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const FIT_ZOOM = 1;
/** Same reading width as other embedded document viewers (tickets, approvals, etc.). */
const MAX_DOCUMENT_WIDTH_PX = 960;
/** Must match Form Builder `pdfAllPagesStackedToDataUrl` default so % maps stay locked. */
const PLACEMENT_PDF_RENDER_WIDTH = 1600;

/**
 * Full form page + placement overlay.
 * Same canvas shell as Form Builder: CSS vars on the relative box, markers in
 * `placement-scale-root`, left/top % only — no extra position tweaks.
 */
function MappedFormPage({
  imageSrc,
  alt,
  overlay,
  baseWidth,
  zoom,
  onImageError,
  fullBleed,
  placementFontSize = DEFAULT_PRINT_PLACEMENT_FONT_SIZE,
}: {
  imageSrc: string;
  alt: string;
  overlay?: ReactNode;
  baseWidth: number;
  zoom: number;
  onImageError?: () => void;
  fullBleed?: boolean;
  placementFontSize?: number;
}) {
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const displayWidth = Math.round(baseWidth * zoom);

  useEffect(() => {
    setNaturalWidth(null);
  }, [imageSrc]);

  // Full-bleed dialogs: always span 100% of the viewport (zoom grows past that).
  // Embedded previews: fixed reading width, centered — not stretched to the panel.
  const outerStyle = fullBleed
    ? zoom === 1
      ? { width: "100%" as const }
      : { width: `${zoom * 100}%` }
    : { width: displayWidth, maxWidth: "100%" };

  return (
    <div className={cn("w-full", !fullBleed && "mx-auto")} style={outerStyle}>
      <div
        className={cn(
          "relative w-full overflow-visible bg-white",
          fullBleed ? "rounded-none shadow-none ring-0" : "rounded-md shadow-sm ring-1 ring-border/80",
        )}
        style={placementCanvasStyle(placementFontSize, naturalWidth)}
      >
        <img
          src={imageSrc}
          alt={alt}
          className="block h-auto w-full max-w-none select-none"
          draggable={false}
          onLoad={(e) => {
            const w = e.currentTarget.naturalWidth;
            if (w > 0) setNaturalWidth(w);
          }}
          onError={onImageError}
        />
        {overlay ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-10",
              naturalWidth ? "placement-scale-root" : null,
            )}
          >
            {overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ViewOnlyDocumentViewerProps = {
  src?: string | null;
  blobLoader?: () => Promise<Blob>;
  enabled?: boolean;
  alt?: string;
  fileLabel?: string;
  overlay?: ReactNode;
  className?: string;
  viewportClassName?: string;
  emptyMessage?: string;
  /** Use all available height (e.g. inside a dialog). */
  fillHeight?: boolean;
  /** Same font size Admin set when mapping fields (keeps glyphs on the mapped spots). */
  placementFontSize?: number;
};

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 10) / 10));
}

function fileNameFromPath(path: string) {
  return path.split("/").pop()?.replace(/^\d+-/, "") || "Document";
}

function useDocumentLayout(enabled: boolean, fillWidth = false) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(fillWidth ? 1200 : MAX_DOCUMENT_WIDTH_PX);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !enabled) return;

    const update = () => {
      // Edge-to-edge in dialogs (no inset); page embeds keep a small gutter + 960 cap.
      const padding = fillWidth ? 0 : 48;
      const available = Math.max(280, el.clientWidth - padding);
      setBaseWidth(fillWidth ? available : Math.min(MAX_DOCUMENT_WIDTH_PX, available));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, fillWidth]);

  return { viewportRef, baseWidth };
}

function ZoomToolbar({
  zoom,
  fitZoom,
  fileLabel,
  onZoomOut,
  onZoomIn,
  onReset,
}: {
  zoom: number;
  fitZoom: number;
  fileLabel?: string;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-muted/25 px-3 py-2.5 sm:px-4">
      {fileLabel ? (
        <p className="min-w-0 truncate text-xs font-semibold text-foreground sm:text-sm">
          {fileLabel}
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-background p-1 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={zoom <= MIN_ZOOM}
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={zoom >= MAX_ZOOM}
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={Math.abs(zoom - fitZoom) < 0.05}
          onClick={onReset}
          aria-label="Reset zoom"
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}

function DocumentViewport({
  viewportRef,
  fillHeight,
  children,
  viewportClassName,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  fillHeight?: boolean;
  children: ReactNode;
  viewportClassName?: string;
}) {
  return (
    <div
      ref={viewportRef}
      className={cn(
        "document-preview-viewport min-w-0 overflow-auto",
        fillHeight
          ? "document-preview-viewport--bleed min-h-0 flex-1 bg-background p-0"
          : "max-h-[min(70vh,720px)] bg-muted/25 p-4 sm:p-6",
        viewportClassName,
      )}
    >
      {children}
    </div>
  );
}

function LoadingState() {
  return <PanelLoading label="Loading document…" />;
}

function ImageDocument({
  src,
  alt,
  zoom,
  baseWidth,
  viewportRef,
  fillHeight,
  overlay,
  viewportClassName,
  placementFontSize,
}: {
  src: string;
  alt: string;
  zoom: number;
  baseWidth: number;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  fillHeight?: boolean;
  overlay?: ReactNode;
  viewportClassName?: string;
  placementFontSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const displayWidth = Math.round(baseWidth * zoom);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <EmptyState
        title="Could not load image"
        description="The document image failed to load. Try refreshing the page."
      />
    );
  }

  if (overlay) {
    return (
      <DocumentViewport
        viewportRef={viewportRef}
        fillHeight={fillHeight}
        viewportClassName={viewportClassName}
      >
        <MappedFormPage
          imageSrc={src}
          alt={alt}
          overlay={overlay}
          baseWidth={baseWidth}
          zoom={zoom}
          onImageError={() => setFailed(true)}
          fullBleed={fillHeight}
          placementFontSize={placementFontSize}
        />
      </DocumentViewport>
    );
  }

  return (
    <DocumentViewport
      viewportRef={viewportRef}
      fillHeight={fillHeight}
      viewportClassName={viewportClassName}
    >
      <div
        className={cn("w-full", !fillHeight && "mx-auto")}
        style={
          fillHeight
            ? zoom === 1
              ? { width: "100%" }
              : { width: `${zoom * 100}%` }
            : { width: displayWidth, maxWidth: "100%" }
        }
      >
        <div
          className={cn(
            "relative w-full overflow-hidden bg-white",
            fillHeight
              ? "rounded-none shadow-none ring-0"
              : "rounded-md shadow-sm ring-1 ring-border/80",
          )}
        >
          <img
            src={src}
            alt={alt}
            className="block h-auto w-full max-w-none select-none"
            draggable={false}
            onError={() => setFailed(true)}
          />
        </div>
      </div>
    </DocumentViewport>
  );
}

async function loadDocumentBlob(src: string, blobLoader?: () => Promise<Blob>) {
  if (blobLoader) {
    return blobLoader();
  }
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Could not load document (${response.status}).`);
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("Document file is empty.");
  }
  return blob;
}

function PdfEmbedDocument({
  src,
  blobLoader,
  alt,
  zoom,
  baseWidth,
  viewportRef,
  fillHeight,
  overlay,
  viewportClassName,
  placementFontSize,
}: {
  src?: string | null;
  blobLoader?: () => Promise<Blob>;
  alt: string;
  zoom: number;
  baseWidth: number;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  fillHeight?: boolean;
  overlay?: ReactNode;
  viewportClassName?: string;
  placementFontSize?: number;
}) {
  const [pageImageUrls, setPageImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showMappedOverlay = Boolean(overlay);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPageImageUrls([]);

      try {
        const resolved = src ? resolveMediaUrl(src) : null;
        if (!resolved && !blobLoader) {
          throw new Error("No document source.");
        }
        const blob = await loadDocumentBlob(resolved ?? "", blobLoader);

        if (showMappedOverlay) {
          // Same stack width as Form Builder so mapped % stays locked to the form.
          const { dataUrl } = await pdfBlobAllPagesStackedToDataUrl(blob, {
            maxWidth: PLACEMENT_PDF_RENDER_WIDTH,
          });
          if (!cancelled) setPageImageUrls([dataUrl]);
          return;
        }

        const { dataUrls } = await pdfBlobAllPagesToDataUrls(blob, {
          maxWidth: fillHeight ? 2000 : 1600,
        });
        if (!cancelled) setPageImageUrls(dataUrls);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load document.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [src, blobLoader, showMappedOverlay, fillHeight]);

  const displayWidth = Math.round(baseWidth * zoom);

  if (loading) return <LoadingState />;
  if (error) {
    return <EmptyState title="Could not load document" description={error} />;
  }
  if (pageImageUrls.length === 0) return null;

  if (showMappedOverlay) {
    return (
      <DocumentViewport
        viewportRef={viewportRef}
        fillHeight={fillHeight}
        viewportClassName={viewportClassName}
      >
        <MappedFormPage
          imageSrc={pageImageUrls[0]}
          alt={alt}
          overlay={overlay}
          baseWidth={baseWidth}
          zoom={zoom}
          fullBleed={fillHeight}
          placementFontSize={placementFontSize}
        />
      </DocumentViewport>
    );
  }

  return (
    <DocumentViewport
      viewportRef={viewportRef}
      fillHeight={fillHeight}
      viewportClassName={viewportClassName}
    >
      <div
        className={cn("w-full space-y-4", !fillHeight && "mx-auto")}
        style={
          fillHeight
            ? zoom === 1
              ? { width: "100%" }
              : { width: `${zoom * 100}%` }
            : { width: displayWidth, maxWidth: "100%" }
        }
      >
        {pageImageUrls.map((pageImageUrl, index) => (
          <div
            key={`${index}-${pageImageUrl.slice(22, 64)}`}
            className={cn(
              "relative w-full overflow-hidden bg-white",
              fillHeight
                ? "rounded-none shadow-none ring-0"
                : "rounded-md shadow-sm ring-1 ring-border/80",
            )}
          >
            <img
              src={pageImageUrl}
              alt={pageImageUrls.length > 1 ? `${alt} (page ${index + 1})` : alt}
              className="block h-auto w-full select-none"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </DocumentViewport>
  );
}

export function ViewOnlyDocumentViewer({
  src,
  blobLoader,
  enabled = true,
  alt = "Document",
  fileLabel,
  overlay,
  className,
  viewportClassName,
  emptyMessage = "No document is available.",
  fillHeight = false,
  placementFontSize = DEFAULT_PRINT_PLACEMENT_FONT_SIZE,
}: ViewOnlyDocumentViewerProps) {
  const [zoom, setZoom] = useState(FIT_ZOOM);
  const { viewportRef, baseWidth } = useDocumentLayout(enabled, fillHeight);
  const resolvedSrc = src ? resolveMediaUrl(src) : null;
  const isImage = resolvedSrc ? isImagePath(resolvedSrc) : false;
  const isPdf = resolvedSrc ? isPdfPath(resolvedSrc) : Boolean(blobLoader);
  const label = fileLabel ?? (src ? fileNameFromPath(src) : undefined);

  useEffect(() => {
    setZoom(FIT_ZOOM);
  }, [src, blobLoader]);

  if (!enabled) return null;

  if (!blobLoader && !resolvedSrc) {
    return <EmptyState title="No document" description={emptyMessage} />;
  }

  const toolbar = (
    <ZoomToolbar
      zoom={zoom}
      fitZoom={FIT_ZOOM}
      fileLabel={label}
      onZoomOut={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
      onZoomIn={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
      onReset={() => setZoom(FIT_ZOOM)}
    />
  );

  const shellClass = cn(
    "min-w-0 w-full",
    fillHeight && "flex h-full min-h-0 flex-col",
    className,
  );

  if (isImage && resolvedSrc) {
    return (
      <div className={shellClass}>
        {toolbar}
        <ImageDocument
          src={resolvedSrc}
          alt={alt}
          zoom={zoom}
          baseWidth={baseWidth}
          viewportRef={viewportRef}
          fillHeight={fillHeight}
          overlay={overlay}
          viewportClassName={viewportClassName}
          placementFontSize={placementFontSize}
        />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className={shellClass}>
        {toolbar}
        <PdfEmbedDocument
          src={resolvedSrc}
          blobLoader={blobLoader}
          alt={alt}
          zoom={zoom}
          baseWidth={baseWidth}
          viewportRef={viewportRef}
          fillHeight={fillHeight}
          overlay={overlay}
          viewportClassName={viewportClassName}
          placementFontSize={placementFontSize}
        />
      </div>
    );
  }

  return <EmptyState title="Unsupported document" description={emptyMessage} />;
}
