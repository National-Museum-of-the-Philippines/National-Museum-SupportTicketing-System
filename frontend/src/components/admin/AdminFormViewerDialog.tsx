import { useQuery } from "@tanstack/react-query";
import { DocumentViewerDialog } from "@/components/documents/DocumentViewerDialog";
import { FormUploadedFileViewer } from "@/components/records/FormUploadedFileViewer";
import { api } from "@/lib/api/client";

type AdminFormViewerDialogProps = {
  formId: string | null;
  formTitle?: string;
  refNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** My Forms → View: show this form's uploaded template. */
export function AdminFormViewerDialog({
  formId,
  formTitle,
  refNumber,
  open,
  onOpenChange,
}: AdminFormViewerDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-form", formId],
    queryFn: () => api.getForm(formId!),
    enabled: open && Boolean(formId),
  });

  const form = data?.form;
  const title = formTitle
    ? `${formTitle}${refNumber ? ` (${refNumber})` : ""}`
    : "Form file";

  return (
    <DocumentViewerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Uploaded form template. View only."
    >
      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading file…</p>
      ) : isError || !form ? (
        <p className="py-16 text-center text-sm text-destructive">Could not load file.</p>
      ) : (
        <FormUploadedFileViewer form={form} enabled={open} />
      )}
    </DocumentViewerDialog>
  );
}
