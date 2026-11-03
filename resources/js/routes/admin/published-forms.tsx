import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { FormFileDialog, type FormFileSelection } from "@/components/form-report/FormFileDialog";
import {
  DataPanel,
  EmptyState,
  LoadingRows,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/admin/published-forms")({
  component: PublishedFormsPage,
});

type Selected = FormFileSelection;

function PublishedFormsPage() {
  const { canQuery } = useAdminSession();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-published-forms"],
    queryFn: () => api.adminPublishedForms(),
    enabled: canQuery,
  });

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.items ?? [];
    if (!q) return all;
    return all.filter((f) => `${f.title} ${f.refNumber}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Published Forms"
        description="Live TA forms that clients can currently submit requests with."
      />

      <DataPanel
        title={`${items.length} published form${items.length === 1 ? "" : "s"}`}
        action={
          <div className="relative w-56 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms"
              aria-label="Search published forms"
              className="h-9 pl-8"
            />
          </div>
        }
      >
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
              {!canQuery || isLoading ? (
                <LoadingRows cols={5} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title={search ? "No forms match your search." : "No published forms yet."}
                      description={
                        search ? undefined : "Forms approved by Records will appear here once published."
                      }
                    />
                  </td>
                </tr>
              ) : (
                items.map((row) => (
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
                          setSelected({ id: row._id, title: row.title, refNumber: row.refNumber })
                        }
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        View file
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataPanel>

      <FormFileDialog selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
