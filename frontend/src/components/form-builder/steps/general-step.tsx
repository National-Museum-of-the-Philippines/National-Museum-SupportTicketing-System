import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { EffectivityDatePicker } from "@/components/form-builder/EffectivityDatePicker";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import type { FormDraft } from "@/lib/form-builder-store";
import { inputCls, SectionHeader, WizardCard, WizardField } from "../shared";

type GeneralStepProps = {
  draft: FormDraft;
  update: (patch: Partial<FormDraft>) => void;
};

export function GeneralStep({ draft, update }: GeneralStepProps) {
  const { user } = useAuth();

  const { data: profileData } = useQuery({
    queryKey: ["requester-profile", "admin", user?.id],
    queryFn: () => api.requesterProfile("admin"),
    enabled: Boolean(user?.id),
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Same source as print template {{prof_division}} (PAMANA section).
  const divisionSection =
    (profileData?.values?.["{{prof_division}}"] ?? "").trim() ||
    (profileData?.profile?.division ?? "").trim() ||
    (user?.division ?? "").trim();

  useEffect(() => {
    if (!divisionSection) return;
    if ((draft.department ?? "").trim() === divisionSection) return;
    update({ department: divisionSection });
  }, [divisionSection, draft.department, update]);

  return (
    <WizardCard>
      <SectionHeader
        title="General information"
        subtitle="The opening details that identify this form."
      />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <WizardField label="Form title">
            <input
              className={inputCls}
              placeholder="e.g. Service Request Form / Facility Request"
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </WizardField>
        </div>
        <WizardField label="Reference number" hint="Auto-generated">
          <input className={`${inputCls} font-mono`} value={draft.refNumber} readOnly />
        </WizardField>
        <WizardField label="Date effectivity" hint="Pick any date">
          <EffectivityDatePicker
            value={draft.effectivity}
            onChange={(effectivity) => update({ effectivity })}
          />
        </WizardField>
        <WizardField label="Version number">
          <input
            className={inputCls}
            value={draft.version}
            onChange={(e) => update({ version: e.target.value })}
          />
        </WizardField>
        <WizardField
          label="Division/Section"
          hint="From your login — same as print template {{prof_division}}"
        >
          <input
            className={inputCls}
            value={divisionSection || draft.department || ""}
            readOnly
            placeholder={profileData && !divisionSection ? "No PAMANA section on this account" : ""}
          />
        </WizardField>
      </div>
    </WizardCard>
  );
}
