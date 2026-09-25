import type { FormRecord } from "@/lib/api/types";
import { FormTemplateFileViewer } from "@/components/documents/FormTemplateFileViewer";

type FormUploadedFileViewerProps = {
  form: FormRecord;
  enabled?: boolean;
  className?: string;
  viewportClassName?: string;
  fillHeight?: boolean;
};

/** Records review — uploaded template with field placements visible (same as Form Builder). */
export function FormUploadedFileViewer(props: FormUploadedFileViewerProps) {
  return (
    <FormTemplateFileViewer
      {...props}
      showMappedPlaceholders
      emptyMessage="No form file was uploaded with this submission."
    />
  );
}
