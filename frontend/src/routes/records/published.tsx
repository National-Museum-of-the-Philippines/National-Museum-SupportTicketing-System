import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DataPanel,
  EmptyState,
  LoadingRows,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { FormPdfViewerDialog } from "@/components/records/FormPdfViewerDialog";
import { api } from "@/lib/api/client";
import { useRecordsSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/records/published")({
  component: PublishedFormsPage,
});

function PublishedFormsPage() {
  const { canQuery } = useRecordsSession();
  const [viewForm, setViewForm] = useState<{ id: string; title: string; refNumber: string } | null>(
    null,
  );
  const { data, isLoading } = useQuery({
    queryKey: ["records-published"],
    queryFn: () => api.recordsForms({ status: "published" }),
    enabled: canQuery,
  });

  const items = data?.items ?? [];

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Published Forms"
        description="Live TA forms available for clients to submit requests."
      />

      <DataPanel title={`${items.length} published form${items.length === 1 ? "" : "s"}`}>
        {!canQuery || isLoading ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-6 py-3">Form</th>
                  <th className="px-6 py-3">Ref</th>
                  <th className="px-6 py-3">Effectivity</th>
                  <th className="px-6 py-3">Version</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                <LoadingRows cols={5} />
              </tbody>
            </table>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No published forms."
            description="Approved forms from Pending Forms will appear here once published."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-6 py-3">Form</th>
                  <th className="px-6 py-3">Ref</th>
                  <th className="px-6 py-3">Effectivity</th>
                  <th className="px-6 py-3">Version</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row._id} className="border-t border-border/70">
                    <td className="px-6 py-3 font-medium">{row.title}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                      {row.refNumber}
                    </td>
                    <td className="px-6 py-3">{row.effectivity}</td>
                    <td className="px-6 py-3 text-muted-foreground">{row.version}</td>
                    <td className="px-6 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setViewForm({ id: row._id, title: row.title, refNumber: row.refNumber })
                        }
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        View file
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      <FormPdfViewerDialog
        formId={viewForm?.id ?? null}
        formTitle={viewForm?.title}
        refNumber={viewForm?.refNumber}
        open={Boolean(viewForm)}
        onOpenChange={(open) => {
          if (!open) setViewForm(null);
        }}
      />
    </div>
  );
}
