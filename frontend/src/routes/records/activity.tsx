import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DataPanel,
  EmptyState,
  LoadingRows,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { api } from "@/lib/api/client";
import { useRecordsSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/records/activity")({
  component: ActivityLogsPage,
});

export function ActivityLogsPage() {
  const { canQuery } = useRecordsSession();
  const { data, isLoading } = useQuery({
    queryKey: ["records-activity"],
    queryFn: () => api.recordsActivity(),
    enabled: canQuery,
  });

  const items = data?.items ?? [];

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Activity Logs"
        description="Audit trail of form reviews, publications, and other Records actions."
      />

      <DataPanel title={`${items.length} recent event${items.length === 1 ? "" : "s"}`}>
        {!canQuery || isLoading ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-6 py-3">When</th>
                  <th className="px-6 py-3">Actor</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Summary</th>
                </tr>
              </thead>
              <tbody>
                <LoadingRows cols={4} />
              </tbody>
            </table>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No activity yet."
            description="Actions will be logged here as they occur."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-6 py-3">When</th>
                  <th className="px-6 py-3">Actor</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Summary</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a._id} className="border-t border-border/70">
                    <td className="px-6 py-3 text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">{a.actorName}</td>
                    <td className="px-6 py-3 capitalize">{a.action.replace(/_/g, " ")}</td>
                    <td className="px-6 py-3">{a.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}
