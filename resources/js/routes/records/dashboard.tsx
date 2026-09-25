import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, FolderOpen } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import {
  ActionLink,
  DashboardAlert,
  DashboardHero,
  DataPanel,
  EmptyState,
  FormStatusBadge,
  ListRow,
  PanelLoading,
  StatCard,
} from "@/components/layout/workspace-ui";
import { FormPdfViewerDialog } from "@/components/records/FormPdfViewerDialog";
import { RECORDS_PENDING, RECORDS_PUBLISHED } from "@/lib/navigation";
import { useRecordsSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/records/dashboard")({
  component: RecordsDashboardPage,
});

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function RecordsDashboardPage() {
  const { user } = useAuth();
  const { canQuery } = useRecordsSession();
  const [viewForm, setViewForm] = useState<{ id: string; title: string; refNumber: string } | null>(
    null,
  );
  const { data, isLoading } = useQuery({
    queryKey: ["records-dashboard"],
    queryFn: () => api.recordsDashboard(),
    enabled: canQuery,
  });

  const pending = data?.recentPending ?? [];
  const published = data?.recentPublished ?? [];
  const firstName = user?.name?.split(" ")[0];
  const pendingCount = data?.pendingCount ?? 0;

  return (
    <div className="page-shell">
      <DashboardHero
        eyebrow="Records"
        title={firstName ? `Welcome, ${firstName}` : "Dashboard"}
        description="Review admin-submitted forms and publish approved TA forms for client use."
        meta={<p className="time-pill">{formatToday()}</p>}
        actions={
          pendingCount > 0 ? (
            <ActionLink to={RECORDS_PENDING}>Review pending ({pendingCount})</ActionLink>
          ) : (
            <ActionLink to={RECORDS_PUBLISHED} variant="outline">
              Published forms
            </ActionLink>
          )
        }
      />

      {pendingCount > 0 ? (
        <DashboardAlert tone="warning" title={`${pendingCount} form${pendingCount === 1 ? "" : "s"} awaiting review`}>
          Approve and publish forms, or return them to Admin with remarks.
        </DashboardAlert>
      ) : null}

      <div className="dashboard-stats dashboard-stats-2">
        <StatCard
          label="Pending review"
          value={pendingCount}
          hint="Needs your decision"
          to={RECORDS_PENDING}
          icon={FileText}
          accent="warning"
          loading={isLoading}
        />
        <StatCard
          label="Published forms"
          value={data?.publishedCount ?? 0}
          hint="Available to clients"
          to={RECORDS_PUBLISHED}
          icon={FolderOpen}
          accent="success"
          loading={isLoading}
        />
      </div>

      <DataPanel
        title="Pending forms"
        action={
          pending.length > 0 ? (
            <ActionLink to={RECORDS_PENDING} variant="outline">
              View all
            </ActionLink>
          ) : undefined
        }
      >
        {isLoading ? (
          <PanelLoading label="Loading forms…" />
        ) : pending.length === 0 ? (
          <EmptyState
            title="No pending forms."
            description="Forms submitted by Admin for review will appear here."
          />
        ) : (
          <ul className="divide-y divide-border/80">
            {pending.map((row) => (
              <ListRow
                key={row._id}
                title={row.title}
                subtitle={`${row.refNumber} · ${row.createdBy?.name ?? "Admin"}`}
                trailing={<FormStatusBadge status={row.status} />}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="shadow-sm"
                      onClick={() =>
                        setViewForm({ id: row._id, title: row.title, refNumber: row.refNumber })
                      }
                    >
                      View file
                    </Button>
                    <Link
                      to="/records/forms/$formId"
                      params={{ formId: row._id }}
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        "shadow-sm",
                      )}
                    >
                      Review
                    </Link>
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </DataPanel>

      <DataPanel
        title="Published forms"
        action={
          published.length > 0 ? (
            <ActionLink to={RECORDS_PUBLISHED} variant="outline">
              View all
            </ActionLink>
          ) : undefined
        }
      >
        {isLoading ? (
          <PanelLoading label="Loading forms…" />
        ) : published.length === 0 ? (
          <EmptyState
            title="No published forms."
            description="Approved forms will appear here once they are live for clients."
          />
        ) : (
          <ul className="divide-y divide-border/80">
            {published.map((row) => (
              <ListRow
                key={row._id}
                title={row.title}
                subtitle={`${row.refNumber} · ${row.createdBy?.name ?? "Admin"}`}
                trailing={<FormStatusBadge status={row.status} />}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    className="shadow-sm"
                    onClick={() =>
                      setViewForm({ id: row._id, title: row.title, refNumber: row.refNumber })
                    }
                  >
                    View file
                  </Button>
                }
              />
            ))}
          </ul>
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
