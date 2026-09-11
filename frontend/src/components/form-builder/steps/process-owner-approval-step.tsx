import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import type { ActionOfficerDraft, FormDraft } from "@/lib/form-builder-store";
import { useAdminSession } from "@/lib/use-portal-session";
import { cn } from "@/lib/utils";
import { inputCls, SectionHeader, WizardCard } from "../shared";

type ProcessOwnerApprovalStepProps = {
  draft: FormDraft;
  update: (patch: Partial<FormDraft>) => void;
};

function emptyOfficer(): ActionOfficerDraft {
  return { userId: "", name: "", email: "", division: "" };
}

function officersFromDraft(draft: FormDraft): ActionOfficerDraft[] {
  const list = draft.actionOfficers ?? [];
  if (list.length > 0) return list;
  return [emptyOfficer()];
}

function syncOfficers(next: ActionOfficerDraft[]) {
  const cleaned = next.length > 0 ? next : [emptyOfficer()];
  return {
    actionOfficers: cleaned,
    actionOfficerCount: Math.max(1, cleaned.filter((o) => o.userId.trim()).length || cleaned.length),
  };
}

function workflowPreview(officers: ActionOfficerDraft[]): { label: string; role: string }[] {
  const named = officers.map((o, i) =>
    o.name.trim() || o.userId.trim() ? o.name.trim() || `Action Officer #${i + 1}` : `Action Officer #${i + 1}`,
  );
  const count = Math.max(1, named.length);

  if (count <= 1) {
    return [
      { label: named[0], role: "Approval" },
      { label: named[0], role: "Task Assignment" },
      { label: "Selected personnel", role: "In Progress" },
    ];
  }

  const steps: { label: string; role: string }[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    steps.push({ label: named[i], role: "Approval" });
  }
  steps.push({ label: named[count - 1], role: "Task Assignment" });
  steps.push({ label: "Selected personnel", role: "In Progress" });
  return steps;
}

export function ProcessOwnerApprovalStep({ draft, update }: ProcessOwnerApprovalStepProps) {
  const { canQuery } = useAdminSession();
  const officers = officersFromDraft(draft);
  const preview = workflowPreview(officers);

  const { data, isLoading } = useQuery({
    queryKey: ["action-officer-staff"],
    queryFn: () => api.listActionOfficerStaff(),
    enabled: canQuery,
  });

  const staff = data?.users ?? [];
  const sectionName = (data?.sectionName || "").trim();
  const selectedIds = useMemo(
    () => new Set(officers.map((o) => o.userId).filter(Boolean)),
    [officers],
  );
  const staffOptions = useMemo(() => {
    const extra = officers.filter(
      (o) => o.userId.trim() && !staff.some((u) => u._id === o.userId),
    );
    if (extra.length === 0) return staff;
    return [
      ...staff,
      ...extra.map((o) => ({
        _id: o.userId,
        name: o.name || o.userId,
        email: o.email ?? "",
        division: o.division ?? "",
      })),
    ];
  }, [staff, officers]);

  const setOfficerAt = (index: number, userId: string) => {
    const person = staffOptions.find((u) => u._id === userId);
    const next = officers.map((row, i) => {
      if (i !== index) return row;
      if (!person) return emptyOfficer();
      return {
        userId: person._id,
        name: person.name,
        email: person.email,
        division: person.division,
      };
    });
    update(syncOfficers(next));
  };

  const addOfficer = () => {
    update(syncOfficers([...officers, emptyOfficer()]));
  };

  const removeOfficer = (index: number) => {
    if (officers.length <= 1) return;
    update(syncOfficers(officers.filter((_, i) => i !== index)));
  };

  return (
    <WizardCard>
      <SectionHeader
        title="Process Owner Approval"
        subtitle="Select Action Officers from the form creator's section. Earlier officers approve; the last one assigns the task."
      />

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Action Officer
          </h3>
          {sectionName ? (
            <p className="text-xs text-muted-foreground">
              Active staff from section: <span className="font-medium text-foreground">{sectionName}</span>
            </p>
          ) : !isLoading ? (
            <p className="text-xs text-amber-800">
              Your PAMANA section could not be resolved, so staff cannot be loaded.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          {officers.map((officer, index) => (
            <div key={`ao-${index}`} className="flex items-center gap-2">
              <select
                className={cn(inputCls, "min-w-0 flex-1")}
                value={officer.userId}
                disabled={isLoading}
                onChange={(e) => setOfficerAt(index, e.target.value)}
                aria-label={`Action Officer ${index + 1} staff name`}
              >
                <option value="">
                  {isLoading ? "Loading staff…" : "Staff name"}
                </option>
                {staffOptions.map((u) => {
                  const takenElsewhere = selectedIds.has(u._id) && u._id !== officer.userId;
                  return (
                    <option key={u._id} value={u._id} disabled={takenElsewhere}>
                      {u.name}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-foreground shadow-sm transition-colors hover:bg-muted/60"
                onClick={addOfficer}
                title="Add Action Officer"
                aria-label="Add Action Officer"
              >
                <Plus className="h-4 w-4" />
              </button>
              {officers.length > 1 ? (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted/60 hover:text-foreground"
                  onClick={() => removeOfficer(index)}
                  title="Remove Action Officer"
                  aria-label={`Remove Action Officer ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {!isLoading && staff.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active staff found in the form creator&apos;s section.
          </p>
        ) : null}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-paper/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live Workflow Preview
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {preview.map((step, index) => (
            <div key={`${step.label}-${step.role}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
              ) : null}
              <span
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium",
                  step.role === "Task Assignment"
                    ? "border-teal-600/25 bg-teal-50 text-teal-900"
                    : step.role === "In Progress"
                      ? "border-emerald-600/25 bg-emerald-50 text-emerald-900"
                      : "border-maroon/20 bg-maroon/5 text-foreground",
                )}
              >
                {step.label}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({step.role})
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </WizardCard>
  );
}
