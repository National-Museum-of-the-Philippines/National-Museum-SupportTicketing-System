import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock3,
  MonitorSmartphone,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DataPanel,
  EmptyState,
  LoadingRows,
  StatCard,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";
import type { ErrorLogLevel, ErrorLogRecord, ErrorLogSource } from "@/lib/api/types";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin/errors")({
  component: SuperAdminErrorsPage,
});

type StatusFilter = "open" | "resolved" | "all";

const PER_PAGE = 25;
const SUMMARY_KEY = ["super-admin-errors-summary"];
const LIST_KEY = "super-admin-errors";
const SELECT_CLASS =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm";

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Request failed";
}

function whenLabel(iso: string | null): { relative: string; exact: string } {
  if (!iso) return { relative: "—", exact: "" };
  const date = new Date(iso);
  return {
    relative: formatDistanceToNowStrict(date, { addSuffix: true }),
    exact: format(date, "MMM d, yyyy HH:mm:ss"),
  };
}

function LevelBadge({ level, status }: { level: ErrorLogLevel; status: number | null }) {
  return (
    <span
      className={cn(
        "status-badge",
        level === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {level}
      {status ? ` ${status}` : ""}
    </span>
  );
}

function SourceBadge({ source }: { source: ErrorLogSource }) {
  const label = source === "client" ? "Browser" : source === "console" ? "Console" : "Server";
  return <span className="status-badge border-border bg-muted text-muted-foreground">{label}</span>;
}

function SuperAdminErrorsPage() {
  const { canQuery } = useAdminSession();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>("open");
  const [level, setLevel] = useState<"" | ErrorLogLevel>("");
  const [source, setSource] = useState<"" | ErrorLogSource>("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params: Record<string, string> = {
    status,
    page: String(page),
    perPage: String(PER_PAGE),
  };
  if (level) params.level = level;
  if (source) params.source = source;
  if (appliedSearch) params.q = appliedSearch;

  const summary = useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => api.errorLogSummary(),
    enabled: canQuery,
  });
  const list = useQuery({
    queryKey: [LIST_KEY, params],
    queryFn: () => api.errorLogs(params),
    enabled: canQuery,
  });
  const detail = useQuery({
    queryKey: ["super-admin-error", selectedId],
    queryFn: () => api.errorLog(selectedId as string),
    enabled: canQuery && selectedId !== null,
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    void queryClient.invalidateQueries({ queryKey: [LIST_KEY] });
    if (selectedId) void queryClient.invalidateQueries({ queryKey: ["super-admin-error", selectedId] });
  };

  const mutation = <T,>(fn: (input: T) => Promise<unknown>, done: (input: T) => string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (_data, input) => {
        toast.success(done(input));
        refreshAll();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  const resolve = mutation((id: string) => api.resolveErrorLog(id), () => "Marked as resolved");
  const reopen = mutation((id: string) => api.reopenErrorLog(id), () => "Reopened");
  const remove = mutation(
    (id: string) => api.deleteErrorLog(id).then(() => setSelectedId((cur) => (cur === id ? null : cur))),
    () => "Entry deleted",
  );
  const resolveAll = mutation(
    () => api.resolveAllErrorLogs(),
    () => "All open entries marked as resolved",
  );
  const purgeResolved = mutation(
    () => api.purgeErrorLogs("resolved"),
    () => "Resolved entries deleted",
  );

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const stats = summary.data;
  const selected = detail.data?.item ?? null;

  return (
    <div className="page-shell">
      <WorkspacePageHeader
        title="Error Monitoring"
        description="Server exceptions, browser errors, and console failures recorded by the system. Repeats of the same error are grouped until resolved."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open errors"
          value={stats?.openErrors ?? 0}
          hint="Unresolved server, browser, and console errors"
          icon={Bug}
          accent={stats && stats.openErrors > 0 ? "danger" : "success"}
          loading={summary.isLoading}
        />
        <StatCard
          label="Open warnings"
          value={stats?.openWarnings ?? 0}
          hint="Rejected requests (HTTP 4xx) worth a look"
          icon={AlertTriangle}
          accent={stats && stats.openWarnings > 0 ? "warning" : "default"}
          loading={summary.isLoading}
        />
        <StatCard
          label="Seen in last 24h"
          value={stats?.last24h ?? 0}
          hint={stats?.lastSeenAt ? `Latest ${whenLabel(stats.lastSeenAt).relative}` : "No errors recorded yet"}
          icon={Clock3}
          accent="info"
          loading={summary.isLoading}
        />
        <StatCard
          label="Browser-side"
          value={stats?.bySource.client ?? 0}
          hint={`${stats?.resolved ?? 0} resolved in total`}
          icon={MonitorSmartphone}
          loading={summary.isLoading}
        />
      </div>

      <DataPanel
        title={`${total} ${status === "all" ? "" : status + " "}entr${total === 1 ? "y" : "ies"}`}
        description="Click a row for the full details and stack trace."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={!canQuery}>
              <RefreshCw /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!stats?.open || resolveAll.isPending}
              onClick={() => {
                if (window.confirm("Mark every open entry as resolved?")) resolveAll.mutate(undefined);
              }}
            >
              <CheckCircle2 /> Resolve all
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!stats?.resolved || purgeResolved.isPending}
              onClick={() => {
                if (window.confirm("Permanently delete all resolved entries?")) purgeResolved.mutate(undefined);
              }}
            >
              <Trash2 /> Delete resolved
            </Button>
          </div>
        }
      >
        <form
          onSubmit={applySearch}
          className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3 sm:px-5"
        >
          <select
            className={SELECT_CLASS}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            aria-label="Status"
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
          <select
            className={SELECT_CLASS}
            value={level}
            onChange={(e) => {
              setLevel(e.target.value as "" | ErrorLogLevel);
              setPage(1);
            }}
            aria-label="Level"
          >
            <option value="">Any level</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
          </select>
          <select
            className={SELECT_CLASS}
            value={source}
            onChange={(e) => {
              setSource(e.target.value as "" | ErrorLogSource);
              setPage(1);
            }}
            aria-label="Source"
          >
            <option value="">Any source</option>
            <option value="server">Server</option>
            <option value="client">Browser</option>
            <option value="console">Console</option>
          </select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search message, exception, URL, file, user…"
            className="h-10 min-w-[16rem] flex-1"
          />
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="px-4 py-3 sm:px-5">Last seen</th>
                <th className="px-4 py-3 sm:px-5">Level</th>
                <th className="px-4 py-3 sm:px-5">Error</th>
                <th className="px-4 py-3 sm:px-5">Where</th>
                <th className="px-4 py-3 sm:px-5">User</th>
                <th className="px-4 py-3 text-right sm:px-5">Count</th>
                <th className="px-4 py-3 sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!canQuery || list.isLoading ? (
                <LoadingRows cols={7} />
              ) : list.isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-destructive">
                    {errorMessage(list.error)}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title={status === "open" ? "No open errors." : "Nothing matches these filters."}
                      description={
                        status === "open"
                          ? "New server, browser, and console failures will appear here as they happen."
                          : "Try a different status, level, source, or search term."
                      }
                    />
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const seen = whenLabel(item.lastSeenAt);
                  return (
                    <tr
                      key={item._id}
                      className="cursor-pointer hover:bg-accent/40"
                      onClick={() => setSelectedId(item._id)}
                    >
                      <td className="px-4 py-3 align-top whitespace-nowrap sm:px-5" title={seen.exact}>
                        <div className="text-foreground">{seen.relative}</div>
                        <div className="text-xs text-muted-foreground">{seen.exact}</div>
                      </td>
                      <td className="px-4 py-3 align-top sm:px-5">
                        <div className="flex flex-col items-start gap-1">
                          <LevelBadge level={item.level} status={item.status} />
                          <SourceBadge source={item.source} />
                        </div>
                      </td>
                      <td className="max-w-xl px-4 py-3 align-top sm:px-5">
                        <div className="line-clamp-2 break-words font-medium text-foreground">{item.message}</div>
                        {item.exception ? (
                          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{item.exception}</div>
                        ) : null}
                        {item.resolvedAt ? (
                          <div className="mt-1 text-xs text-emerald-700">
                            Resolved {whenLabel(item.resolvedAt).relative}
                            {item.resolvedBy ? ` by ${item.resolvedBy}` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="max-w-xs px-4 py-3 align-top sm:px-5">
                        {item.file ? (
                          <div className="truncate font-mono text-xs text-foreground" title={`${item.file}:${item.line ?? ""}`}>
                            {item.file}
                            {item.line ? `:${item.line}` : ""}
                          </div>
                        ) : null}
                        {item.url ? (
                          <div className="truncate text-xs text-muted-foreground" title={item.url}>
                            {item.method ? `${item.method} ` : ""}
                            {item.url}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top sm:px-5">
                        <div className="text-foreground">{item.userName ?? "—"}</div>
                        {item.userRole ? (
                          <div className="text-xs text-muted-foreground">{item.userRole}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums sm:px-5">{item.occurrences}</td>
                      <td className="px-4 py-3 align-top sm:px-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {item.resolvedAt ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reopen"
                              disabled={reopen.isPending}
                              onClick={() => reopen.mutate(item._id)}
                            >
                              <RotateCcw /> Reopen
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Mark as resolved"
                              disabled={resolve.isPending}
                              onClick={() => resolve.mutate(item._id)}
                            >
                              <CheckCircle2 /> Resolve
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (window.confirm("Delete this entry permanently?")) remove.mutate(item._id);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > PER_PAGE ? (
          <div className="flex items-center justify-between gap-3 border-t border-border/80 px-4 py-3 text-sm sm:px-5">
            <span className="text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </DataPanel>

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {selected ? <LevelBadge level={selected.level} status={selected.status} /> : null}
              {selected ? <SourceBadge source={selected.source} /> : null}
              <span>Error details</span>
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.occurrences} occurrence${selected.occurrences === 1 ? "" : "s"} · first ${whenLabel(selected.firstSeenAt).exact} · last ${whenLabel(selected.lastSeenAt).exact}`
                : "Loading…"}
            </DialogDescription>
          </DialogHeader>

          {detail.isError ? (
            <p className="text-sm text-destructive">{errorMessage(detail.error)}</p>
          ) : selected ? (
            <ErrorDetails item={selected} />
          ) : null}

          {selected ? (
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {selected.resolvedAt ? (
                <Button variant="outline" size="sm" onClick={() => reopen.mutate(selected._id)}>
                  <RotateCcw /> Reopen
                </Button>
              ) : (
                <Button size="sm" onClick={() => resolve.mutate(selected._id)}>
                  <CheckCircle2 /> Mark as resolved
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm("Delete this entry permanently?")) remove.mutate(selected._id);
                }}
              >
                <Trash2 /> Delete
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function ErrorDetails({ item }: { item: ErrorLogRecord }) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm font-medium text-foreground break-words">
        {item.message}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Exception / kind">
          <span className="font-mono text-xs">{item.exception ?? "—"}</span>
        </Field>
        <Field label="Location">
          <span className="font-mono text-xs">
            {item.file ? `${item.file}${item.line ? `:${item.line}` : ""}` : "—"}
          </span>
        </Field>
        <Field label="Request">
          <span className="font-mono text-xs">
            {item.method ? `${item.method} ` : ""}
            {item.url ?? "—"}
          </span>
        </Field>
        <Field label="User">
          {item.userName ? `${item.userName}${item.userRole ? ` (${item.userRole})` : ""}` : "Not signed in"}
        </Field>
        <Field label="IP address">{item.ip ?? "—"}</Field>
        <Field label="Browser">
          <span className="text-xs">{item.userAgent ?? "—"}</span>
        </Field>
        {item.resolvedAt ? (
          <Field label="Resolved">
            {whenLabel(item.resolvedAt).exact}
            {item.resolvedBy ? ` by ${item.resolvedBy}` : ""}
          </Field>
        ) : null}
        <Field label="Fingerprint">
          <span className="font-mono text-xs">{item.fingerprint.slice(0, 12)}</span>
        </Field>
      </dl>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stack trace</p>
        <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
          {item.trace?.trim() || "No stack trace recorded."}
        </pre>
      </div>
    </div>
  );
}
