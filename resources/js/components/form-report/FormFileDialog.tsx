import { useQuery } from "@tanstack/react-query";
import { DocumentViewerDialog } from "@/components/documents/DocumentViewerDialog";
import { FormUploadedFileViewer } from "@/components/records/FormUploadedFileViewer";
import { api } from "@/lib/api/client";

export type FormFileSelection = { id: string; title: string; refNumber: string };
type Selected = FormFileSelection;

export function FormFileDialog({
  selected,
  onClose,
}: {
  selected: Selected | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-published-form", selected?.id],
    queryFn: () => api.getAdminPublishedForm(selected!.id),
    enabled: Boolean(selected),
  });
  const form = data?.form;

  return (
    <DocumentViewerDialog
      open={Boolean(selected)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={selected ? `${selected.title}${selected.refNumber ? ` (${selected.refNumber})` : ""}` : "Form file"}
      description="Published form template. View only."
    >
      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading file…</p>
      ) : isError || !form ? (
        <p className="py-16 text-center text-sm text-destructive">Could not load file.</p>
      ) : (
        <FormUploadedFileViewer form={form} enabled />
      )}
    </DocumentViewerDialog>
  );
}
