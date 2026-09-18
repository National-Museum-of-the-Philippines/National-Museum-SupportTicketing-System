import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FileUp,
  GripVertical,
  Loader2,
  Printer,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_PRINT_PLACEMENT_FONT_SIZE,
  MAX_PRINT_PLACEMENT_FONT_SIZE,
  MIN_PRINT_PLACEMENT_FONT_SIZE,
  type FormDraft,
  type PrintFieldPlacement,
} from "@/lib/form-builder-store";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { buildPrintReadyText, buildSampleSubmissionValues } from "@/lib/print-merge";
import {
  isChoiceFieldType,
  PLACEMENT_CHECKMARK,
  resolvePlacementOption,
} from "@/lib/placement-choice-values";
import { api } from "@/lib/api/client";
import { getMissingProfilePlacements } from "@/lib/profile-placement-fields";
import {
  isAllowedPrintTemplate,
  MAX_UPLOAD_MB,
  TEMPLATE_ACCEPT,
  uploadTooLarge,
} from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

type PrintTemplateStepProps = {
  draft: FormDraft;
  update: (patch: Partial<FormDraft>) => void;
};

export function PrintTemplateStep({ draft, update }: PrintTemplateStepProps) {
  const placements = draft.printPlacements ?? [];
  const image = draft.printTemplateImage ?? null;
  const canvasRef = useRef<HTMLDivElement>(null);
  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  const [zoom, setZoom] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [templateNaturalWidth, setTemplateNaturalWidth] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTemplateNaturalWidth(null);
  }, [image]);

  const mergedPrintPreview = useMemo(
    () => buildPrintReadyText(draft.printTemplate ?? "", buildSampleSubmissionValues(draft.fields)),
    [draft.printTemplate, draft.fields],
  );

  const variables = useMemo(
    () =>
      draft.fields.flatMap((field) => {
        if (isChoiceFieldType(field.type) && (field.options?.length ?? 0) > 0) {
          return (field.options ?? []).flatMap((option) => {
            const items = [
              {
                variable: field.variable,
                label: option,
                hint: field.label,
                option: true,
              },
            ];
            // Separate marker for the underscore line beside Others.
            if (/^others?$/i.test(option.trim())) {
              items.push({
                variable: field.variable,
                label: `${option.trim()} (blank)`,
                hint: `${field.label} — typed text on the blank`,
                option: true,
              });
            }
            return items;
          });
        }
        return [{ variable: field.variable, label: field.label, hint: field.label, option: false }];
      }),
    [draft.fields],
  );

  const unplacedProfileFields = useMemo(
    () => getMissingProfilePlacements(placements),
    [placements],
  );

  const unplacedFormFields = useMemo(
    () =>
      variables.filter((item) =>
        item.option
          ? !placements.some((p) => p.variable === item.variable && p.label === item.label)
          : !placements.some((p) => p.variable === item.variable),
      ),
    [variables, placements],
  );

  const sampleValues = useMemo(() => buildSampleSubmissionValues(draft.fields), [draft.fields]);

  const fieldFontSize = draft.printPlacementFontSize ?? DEFAULT_PRINT_PLACEMENT_FONT_SIZE;
  const fieldTextWidth = Math.round(fieldFontSize * 15);
  const templateFileName = draft.printTemplateImagePath
    ? draft.printTemplateImagePath.split("/").pop()?.replace(/^\d+-/, "") || "Template file"
    : null;

  const setPlacements = (next: PrintFieldPlacement[]) => update({ printPlacements: next });

  const setFieldFontSize = (size: number) => {
    update({
      printPlacementFontSize: Math.min(
        MAX_PRINT_PLACEMENT_FONT_SIZE,
        Math.max(MIN_PRINT_PLACEMENT_FONT_SIZE, Math.round(size)),
      ),
    });
  };

  const addPlacement = (variable: string, label: string, xPct: number, yPct: number) => {
    const current = placementsRef.current;
    const isChoiceOption = variables.some(
      (v) => v.option && v.variable === variable && v.label === label,
    );
    const already = isChoiceOption
      ? current.some((p) => p.variable === variable && p.label === label)
      : current.some((p) => p.variable === variable);
    if (already) return;
    const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setPlacements([
      ...current,
      { id, variable, label, xPct: clampPct(xPct), yPct: clampPct(yPct) },
    ]);
  };

  const removePlacement = (id: string) => {
    setPlacements(placementsRef.current.filter((p) => p.id !== id));
  };

  const clearPlacements = () => {
    setPlacements([]);
    toast.info("All field markers removed from the template.");
  };

  const applyTemplateDataUrl = (dataUrl: string, serverPath: string, message: string) => {
    update({ printTemplateImage: dataUrl, printTemplateImagePath: serverPath });
    toast.success(message);
  };

  const onUploadTemplate = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || isUploading) return;

    if (!isAllowedPrintTemplate(file.name, file.type)) {
      toast.error("Only PDF files are allowed.");
      return;
    }

    if (uploadTooLarge(file.size)) {
      toast.error(`File is too large (max ${MAX_UPLOAD_MB} MB). Try compressing the PDF.`);
      return;
    }

    setIsUploading(true);
    try {
      const { pdfAllPagesStackedToDataUrl } = await import("@/lib/pdf-template");
      const { dataUrlToFile } = await import("@/lib/upload-data-url");
      const { dataUrl, pageCount } = await pdfAllPagesStackedToDataUrl(file);
      // Upload the stacked PNG used for placements — not the raw PDF — so Records
      // and Client see the same canvas Admin laid fields on.
      const pngFile = await dataUrlToFile(dataUrl, file.name.replace(/\.pdf$/i, "") || "template");
      const { file: uploaded } = await api.uploadFile(pngFile);
      applyTemplateDataUrl(
        dataUrl,
        uploaded.url,
        pageCount > 1
          ? `PDF uploaded (${pageCount} pages stacked). Drag fields onto any page.`
          : "PDF uploaded. Drag fields onto the form.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload template.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveTemplateLayout = () => {
    const lines = (placementsRef.current ?? []).map(
      (p) => `${p.variable}\t${p.xPct.toFixed(2)}\t${p.yPct.toFixed(2)}\t${p.label}`,
    );
    const block = [
      "[NMP placements]",
      `fontSize\t${fieldFontSize}`,
      ...lines,
      "[/NMP placements]",
    ].join("\n");
    update({
      printPlacements: [...placementsRef.current],
      printTemplate: block,
      printPlacementFontSize: fieldFontSize,
    });
    toast.success("Layout saved.");
  };

  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: PointerEvent) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const xPct = clampPct(((e.clientX - rect.left) / rect.width) * 100);
      const yPct = clampPct(((e.clientY - rect.top) / rect.height) * 100);
      update({
        printPlacements: placementsRef.current.map((p) =>
          p.id === draggingId ? { ...p, xPct, yPct } : p,
        ),
      });
    };
    const onUp = () => setDraggingId(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp, { capture: true });
    };
  }, [draggingId, update]);

  const onDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = canvasRef.current;
    if (!el) return;
    let data: { variable: string; label: string };
    try {
      data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (!data?.variable) return;
    } catch {
      return;
    }
    const rect = el.getBoundingClientRect();
    addPlacement(
      data.variable,
      data.label,
      clampPct(((e.clientX - rect.left) / rect.width) * 100),
      clampPct(((e.clientY - rect.top) / rect.height) * 100),
    );
  };

  const onFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    void onUploadTemplate(e.dataTransfer.files);
  };

  const copyMergedPreview = async () => {
    try {
      await navigator.clipboard.writeText(mergedPrintPreview);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const printMergedPreview = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Pop-up blocked. Allow pop-ups to print.");
      return;
    }
    const safe = mergedPrintPreview
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    w.document.open();
    w.document.write(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Print preview</title>` +
        `<style>body{font-family:system-ui,sans-serif;padding:1.25in;max-width:8in;margin:0 auto;white-space:pre-wrap;font-size:12pt;line-height:1.45}</style></head>` +
        `<body><pre style="white-space:pre-wrap;font-family:inherit;margin:0">${safe}</pre></body></html>`,
    );
    w.document.close();
    w.focus();
    requestAnimationFrame(() => {
      try {
        w.print();
      } catch {
        /* noop */
      }
    });
  };

  const stepActive = (n: number) =>
    (n === 1 && !image) ||
    (n === 2 && !!image && placements.length === 0) ||
    (n === 3 && placements.length > 0);

  return (
    <>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Print template</h2>
          <ol className="mt-3 flex flex-wrap gap-2 text-xs">
            {[
              { n: 1, label: "Upload form (image or PDF)" },
              { n: 2, label: "Place fields" },
              { n: 3, label: "Save layout" },
            ].map((s) => (
              <li
                key={s.n}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
                  stepActive(s.n)
                    ? "border-maroon/30 bg-maroon/8 text-maroon"
                    : "border-border bg-muted/50 text-muted-foreground",
                )}
              >
                <span className="grid h-4 w-4 place-items-center rounded-full bg-maroon/15 text-[10px] font-semibold text-maroon">
                  {s.n}
                </span>
                {s.label}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="wizard-card flex flex-col p-4">
            <p className="text-sm font-medium">Fields to place</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Drag onto the form — each placed field leaves this list.
            </p>
            <div className="mt-3 max-h-64 space-y-3 overflow-y-auto lg:max-h-[min(60vh,520px)]">
              {unplacedProfileFields.length === 0 && unplacedFormFields.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                  {variables.length === 0
                    ? "Add fields in the Fields step first."
                    : "All fields are on the template. Remove a marker to put it back here."}
                </p>
              ) : null}

              {unplacedProfileFields.length > 0 ? (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Requester profile
                  </p>
                  <div className="space-y-2">
                    {unplacedProfileFields.map((v) => (
                      <div
                        key={v.variable}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/json",
                            JSON.stringify({
                              variable: v.variable,
                              label: v.label,
                              hint: v.hint,
                            }),
                          );
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="flex cursor-grab gap-2 rounded-md border border-maroon/25 bg-maroon/5 px-2.5 py-2 active:cursor-grabbing hover:border-maroon/50 hover:bg-maroon/10"
                      >
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{v.label}</div>
                          <div className="mt-0.5 truncate font-mono text-[10px] text-maroon">
                            {v.variable}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {v.hint}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {variables.length === 0 ? (
                unplacedProfileFields.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Form fields
                    </p>
                    <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                      Add fields in the Fields step first.
                    </p>
                  </div>
                ) : null
              ) : unplacedFormFields.length > 0 ? (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Form fields
                  </p>
                  <div className="space-y-2">
                    {unplacedFormFields.map((v) => (
                      <div
                        key={`${v.variable}:${v.label}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify(v));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="flex cursor-grab gap-2 rounded-md border border-border bg-background px-2.5 py-2 active:cursor-grabbing hover:border-maroon/40 hover:bg-maroon/5"
                      >
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{v.label}</div>
                          <div className="mt-0.5 truncate font-mono text-[10px] text-maroon">
                            {v.variable}
                          </div>
                          {v.hint !== v.label ? (
                            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                              {v.hint}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="wizard-card flex min-w-0 flex-col overflow-hidden">
            <input
              ref={fileInputRef}
              type="file"
              accept={TEMPLATE_ACCEPT}
              className="hidden"
              onChange={(e) => void onUploadTemplate(e.target.files)}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              {image ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
                  {templateFileName ? (
                    <p className="max-w-[min(100%,280px)] truncate text-xs font-medium text-foreground sm:text-sm">
                      {templateFileName}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Zoom</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[2.75rem] text-center text-xs tabular-nums">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex min-w-[min(100%,220px)] flex-1 items-center gap-2 sm:max-w-[260px]">
                    <Label
                      htmlFor="field-font-size"
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      Field text
                    </Label>
                    <Slider
                      id="field-font-size"
                      min={MIN_PRINT_PLACEMENT_FONT_SIZE}
                      max={MAX_PRINT_PLACEMENT_FONT_SIZE}
                      step={1}
                      value={[fieldFontSize]}
                      onValueChange={([v]) => setFieldFontSize(v)}
                      className="flex-1"
                      aria-label="Field text size in pixels"
                    />
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-foreground">
                      {fieldFontSize}px
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      onClick={() => setFieldFontSize(DEFAULT_PRINT_PLACEMENT_FONT_SIZE)}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  PDF only · up to {MAX_UPLOAD_MB} MB · multi-page PDFs are stacked
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {isUploading ? "Loading…" : image ? "Replace" : "Choose file"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveTemplateLayout}
                  disabled={!image || isUploading}
                >
                  <Check className="h-4 w-4" />
                  Save layout
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPrintPreviewOpen(true)}
                  disabled={!image}
                >
                  <Printer className="h-4 w-4" />
                  Preview
                </Button>
              </div>
            </div>

            <div className="p-4">
              {isUploading ? (
                <div className="print-upload-zone pointer-events-none">
                  <Loader2 className="h-10 w-10 animate-spin text-maroon" aria-hidden />
                  <span className="text-base font-medium text-foreground">
                    Preparing your template…
                  </span>
                  <span className="text-sm text-muted-foreground">
                    PDFs stack all pages vertically for field placement
                  </span>
                </div>
              ) : !image ? (
                <label
                  className={cn("print-upload-zone cursor-pointer", fileDragOver && "is-dragover")}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setFileDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setFileDragOver(false);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onFileDrop}
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-maroon/10 text-maroon">
                    <Upload className="h-7 w-7" />
                  </span>
                  <span className="text-base font-medium text-foreground">Drop your form here</span>
                  <span className="max-w-md text-sm text-muted-foreground">
                    PDF only — blank form export (all pages are stacked for field placement)
                  </span>
                  <span className="mt-1 inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground">
                    Choose file
                  </span>
                </label>
              ) : (
                <div
                  ref={shellRef}
                  className="print-canvas-shell max-h-[min(70vh,640px)] overflow-auto p-4"
                >
                  <div className="mx-auto w-fit origin-top" style={{ transform: `scale(${zoom})` }}>
                    <div
                      ref={canvasRef}
                      className="print-template-canvas relative inline-block max-w-full overflow-hidden rounded-md bg-white shadow-md ring-1 ring-border"
                      style={
                        {
                          "--dynamic-text-size": `${fieldFontSize}px`,
                          "--dynamic-text-width": `${fieldTextWidth}px`,
                          ...(templateNaturalWidth
                            ? { "--placement-natural-width": templateNaturalWidth }
                            : {}),
                        } as React.CSSProperties
                      }
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={onDropOnCanvas}
                    >
                      <img
                        src={image}
                        alt="Form template"
                        className="block max-w-full select-none"
                        draggable={false}
                        onLoad={(e) => {
                          const w = e.currentTarget.naturalWidth;
                          if (w > 0) setTemplateNaturalWidth(w);
                        }}
                      />
                      <div
                        className={cn(
                          "absolute inset-0",
                          templateNaturalWidth ? "placement-scale-root" : null,
                        )}
                      >
                        {placements.map((p) => {
                          const field = draft.fields.find((item) => item.variable === p.variable);
                          let preview = p.label;
                          if (field && isChoiceFieldType(field.type)) {
                            if (/^others?\s*\(\s*blank\s*\)$/i.test(p.label.trim())) {
                              preview = "…";
                            } else if (resolvePlacementOption(field, p.label)) {
                              preview = PLACEMENT_CHECKMARK;
                            } else {
                              preview = "";
                            }
                          } else {
                            preview =
                              sampleValues[p.variable]?.replace(/\s*\(sample\)\s*$/i, "").trim() ||
                              p.label;
                          }
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={cn(
                                "dynamic-text-anchor",
                                draggingId === p.id && "is-dragging",
                              )}
                              style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
                              title={`${p.variable} — ${preview}`}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                (e.currentTarget as HTMLButtonElement).setPointerCapture(
                                  e.pointerId,
                                );
                                setDraggingId(p.id);
                              }}
                              onPointerUp={(e) => {
                                try {
                                  (e.currentTarget as HTMLButtonElement).releasePointerCapture(
                                    e.pointerId,
                                  );
                                } catch {
                                  /* noop */
                                }
                                setDraggingId(null);
                              }}
                            >
                              <span
                                className={cn(
                                  "dynamic-text",
                                  preview === PLACEMENT_CHECKMARK && "placement-checkmark",
                                )}
                              >
                                {preview}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {image ? (
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">
                    Placed on template
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({placements.length})
                    </span>
                  </p>
                  {placements.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={clearPlacements}
                    >
                      Clear all
                    </Button>
                  ) : null}
                </div>
                {placements.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Drop on the left edge of each line (10px Arial, like the printed form). For
                    checkbox/radio fields, drag each option onto its box — a checkmark (✓) appears
                    when selected, not the option text.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {placements.map((p) => (
                      <li
                        key={p.id}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-2.5 pr-1 text-xs"
                      >
                        <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                        <span className="truncate font-medium">{p.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {p.variable}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removePlacement(p.id)}
                          aria-label={`Remove ${p.label}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>Print preview</DialogTitle>
            <DialogDescription>
              Sample data only — real submissions use employee answers.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-paper p-4 font-sans text-sm leading-relaxed">
              {mergedPrintPreview || "Place fields on the template and save layout first."}
            </pre>
          </div>
          <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setPrintPreviewOpen(false)}>
              Close
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={copyMergedPreview}>
                Copy
              </Button>
              <Button type="button" onClick={printMergedPreview}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
