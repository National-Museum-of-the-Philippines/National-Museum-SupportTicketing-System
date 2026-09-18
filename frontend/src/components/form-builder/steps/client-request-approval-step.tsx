import type { FormDraft } from "@/lib/form-builder-store";
import { cn } from "@/lib/utils";
import { SectionHeader, WizardCard } from "../shared";

type ClientRequestApprovalStepProps = {
  draft: FormDraft;
  update: (patch: Partial<FormDraft>) => void;
};

function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="inline-flex rounded-lg border border-border p-0.5">
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            value
              ? "bg-maroon text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted/60",
          )}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            !value
              ? "bg-maroon text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted/60",
          )}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    </div>
  );
}

function workflowSteps(recommending: boolean, supervisor: boolean): string[] {
  const steps = ["Client"];
  if (recommending) {
    steps.push("Recommending Officer");
    if (supervisor) steps.push("Immediate Supervisor");
  }
  steps.push("Process Owner");
  return steps;
}

export function ClientRequestApprovalStep({ draft, update }: ClientRequestApprovalStepProps) {
  const recommending = draft.requireRecommendingOfficer ?? false;
  const supervisor = draft.requireImmediateSupervisor ?? false;
  const steps = workflowSteps(recommending, supervisor);

  return (
    <WizardCard>
      <SectionHeader
        title="Client Request Approval"
        subtitle="Choose whether a client request needs Recommending Officer and/or Immediate Supervisor approval before Process Owner."
      />

      <div className="mt-6 space-y-3">
        <YesNoToggle
          label="Recommending Officer"
          value={recommending}
          onChange={(requireRecommendingOfficer) =>
            update({
              requireRecommendingOfficer,
              ...(requireRecommendingOfficer ? {} : { requireImmediateSupervisor: false }),
            })
          }
        />
        {recommending ? (
          <YesNoToggle
            label="Immediate Supervisor"
            value={supervisor}
            onChange={(requireImmediateSupervisor) => update({ requireImmediateSupervisor })}
          />
        ) : null}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-paper/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live Workflow Preview
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
              ) : null}
              <span className="rounded-full border border-maroon/20 bg-maroon/5 px-3 py-1.5 text-sm font-medium text-foreground">
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </WizardCard>
  );
}
