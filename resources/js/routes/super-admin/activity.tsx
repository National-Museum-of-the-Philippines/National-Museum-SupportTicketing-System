import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import {
  DataPanel,
  EmptyState,
  PageLoader,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { api } from "@/lib/api/client";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/super-admin/activity")({
  component: SuperAdminActivityPage,
});

function SuperAdminActivityPage() {
  const { canQuery } = useAdminSession();
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-activity"],
    queryFn: () => api.recordsActivity("admin"),
    enabled: canQuery,
  });

  const items = data?.items ?? [];

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Activity Logs / Audit Logs"
        description="System-wide audit trail of significant actions across portals."
      />

      <DataPanel title={`${items.length} recent event${items.length === 1 ? "" : "s"}`}>
        {isLoading ? (
          <div className="px-4 py-6">
            <PageLoader label="Loading activity…" />
          </div>
        ) : (
          <ActivityFeed
            items={items}
            empty={
              <EmptyState
                title="No activity yet."
                description="Actions across the system will appear here."
              />
            }
          />
        )}
      </DataPanel>
    </div>
  );
}
