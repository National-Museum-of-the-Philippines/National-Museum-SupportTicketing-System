import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader, WizardCard, WizardField } from "../shared";
import type { FormDraft } from "@/lib/form-builder-store";
import { api } from "@/lib/api/client";
import {
  isAllowedUpload,
  MAX_UPLOAD_MB,
  SUPPORTING_DOC_ACCEPT,
  uploadTooLarge,
} from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

type ProcedureStepProps = {
  draft: FormDraft;
  update: (patch: Partial<FormDraft>) => void;
};

export function ProcedureStep({ draft, update }: ProcedureStepProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (!isAllowedUpload(file.name, file.type)) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    if (uploadTooLarge(file.size)) {
      toast.error(`File is too large (max ${MAX_UPLOAD_MB} MB).`);
      return;
    }
    setUploading(true);
    try {
      const { file: uploaded } = await api.uploadFile(file);
      update({
        workProcedureName: uploaded.originalName,
        workProcedurePath: uploaded.url,
      });
      toast.success("Supporting document uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <WizardCard className="space-y-6">
      <SectionHeader
        title="Supporting document"
        subtitle="Optional — upload an SOP, guidelines, or any supporting PDF that accompanies this form."
      />
      <WizardField label="Attachment (optional)">
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center transition-colors hover:bg-muted/50",
            uploading && "pointer-events-none opacity-70",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={SUPPORTING_DOC_ACCEPT}
            className="hidden"
            disabled={uploading}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-maroon" />
          ) : (
            <FileUp className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="text-sm font-medium text-foreground">
            {draft.workProcedureName || "Drop a file or click to browse"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            PDF only · max {MAX_UPLOAD_MB} MB
          </div>
        </label>
      </WizardField>
      {draft.workProcedurePath ? (
        <p className="text-sm text-green-700">
          ✓ {draft.workProcedureName || "Document"} ready for Records review
        </p>
      ) : null}
    </WizardCard>
  );
}
