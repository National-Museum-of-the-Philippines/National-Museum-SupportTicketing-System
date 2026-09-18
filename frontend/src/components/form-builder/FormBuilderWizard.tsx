import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { WorkspacePageHeader, PageLoader, FlowNotice } from "@/components/layout/workspace-ui";
import { Progress } from "@/components/ui/progress";
import { api, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { ADMIN_DASHBOARD, dashboardForRole, isAdminRole, LOGIN } from "@/lib/navigation";
import { draftToApiBodyWithUploads } from "@/lib/form-draft-api";
import {
  clearFormBuilderWip,
  loadFormBuilderWip,
  newDraft,
  saveFormBuilderWip,
  type FormDraft,
} from "@/lib/form-builder-store";
import { FORM_BUILDER_STEPS, type FormBuilderStepKey } from "@/lib/form-builder/constants";
import {
  validateFormBuilderStep,
  validateFormBuilderStepsUntil,
} from "@/lib/form-builder/validation";
import { PrintTemplateStep } from "./PrintTemplateStep";
import { ClientRequestApprovalStep } from "./steps/client-request-approval-step";
import { FieldsStep } from "./steps/fields-step";
import { GeneralStep } from "./steps/general-step";
import { ProcedureStep } from "./steps/procedure-step";
import { ProcessOwnerApprovalStep } from "./steps/process-owner-approval-step";

function formSaveErrorMessage(error: unknown, email?: string) {
  if (error instanceof ApiError && error.status === 403) {
    return `Signed in as ${email ?? "another account"} — only admin can create forms. Sign out, then log in with an admin museum account.`;
  }
  return error instanceof Error ? error.message : "Could not save form to server.";
}

function initialWizardState(): { draft: FormDraft; step: FormBuilderStepKey } {
  const wip = loadFormBuilderWip();
  const step = FORM_BUILDER_STEPS.some((s) => s.key === wip?.step)
    ? (wip?.step as FormBuilderStepKey)
    : "general";
  return { draft: wip?.draft ?? newDraft(), step };
}

export function FormBuilderWizard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, isAuthLoading, logout } = useAuth();
  const [draft, setDraft] = useState<FormDraft>(() => initialWizardState().draft);
  const [step, setStep] = useState<FormBuilderStepKey>(() => initialWizardState().step);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const stepIdx = FORM_BUILDER_STEPS.findIndex((s) => s.key === step);
  const stepBlockReason = validateFormBuilderStep(step, draft);

  useEffect(() => {
    if (isAuthLoading) return;
    if (user && !isAdminRole(user.role)) {
      void navigate({ to: dashboardForRole(user.role), replace: true });
    }
  }, [user, isAuthLoading, navigate]);

  useEffect(() => {
    saveFormBuilderWip(draft, step);
  }, [draft, step]);

  const update = useCallback(
    (patch: Partial<FormDraft> | ((current: FormDraft) => Partial<FormDraft>)) => {
      setSaveError(null);
      setDraft((d) => {
        const next = typeof patch === "function" ? patch(d) : patch;
        return { ...d, ...next };
      });
    },
    [],
  );

  const goToStep = useCallback(
    (key: FormBuilderStepKey) => {
      const targetIdx = FORM_BUILDER_STEPS.findIndex((s) => s.key === key);
      if (targetIdx > stepIdx && validateFormBuilderStepsUntil(draft, stepIdx, targetIdx)) return;
      setSaveError(null);
      setStep(key);
    },
    [draft, stepIdx],
  );

  // Keep the wizard mounted once the session is known — auth re-sync must not
  // tear down the draft (that feels like an auto-refresh while editing).
  if (isAuthLoading && !user) {
    return <PageLoader label="Loading form builder…" />;
  }

  if (user && !isAdminRole(user.role)) {
    return null;
  }

  const next = () => {
    if (validateFormBuilderStep(step, draft)) return;
    setSaveError(null);
    setStep(FORM_BUILDER_STEPS[Math.min(stepIdx + 1, FORM_BUILDER_STEPS.length - 1)].key);
  };
  const prev = () => {
    setSaveError(null);
    setStep(FORM_BUILDER_STEPS[Math.max(stepIdx - 1, 0)].key);
  };

  const validateBeforeSave = () => {
    for (let i = 0; i < FORM_BUILDER_STEPS.length; i++) {
      const err = validateFormBuilderStep(FORM_BUILDER_STEPS[i].key, draft);
      if (err) {
        setSaveError(err);
        goToStep(FORM_BUILDER_STEPS[i].key);
        return false;
      }
    }
    return true;
  };

  const saveDraft = async () => {
    setSaveError(null);
    if (!validateBeforeSave()) return;
    setIsSaving(true);
    try {
      const body = await draftToApiBodyWithUploads(draft);
      const { form } = await api.createForm(body);
      await qc.invalidateQueries({ queryKey: ["my-forms"] });
      toast.success(`"${form.title}" saved as draft`);
      clearFormBuilderWip();
      setDraft(newDraft());
      setStep("general");
    } catch (error) {
      setSaveError(formSaveErrorMessage(error, user?.email));
    } finally {
      setIsSaving(false);
    }
  };

  const submitToRecords = async () => {
    setSaveError(null);
    if (!validateBeforeSave()) return;
    setIsSaving(true);
    try {
      const body = await draftToApiBodyWithUploads(draft);
      const { form: submitted } = await api.createAndSubmitForm(body);
      await qc.invalidateQueries({ queryKey: ["my-forms"] });
      await qc.invalidateQueries({ queryKey: ["records-dashboard"] });
      await qc.invalidateQueries({ queryKey: ["records-pending"] });
      toast.success(`"${submitted.title}" submitted to Records`, {
        description: "Open Records portal (separate tab) as a records officer → Pending Forms.",
        duration: 8000,
      });
      clearFormBuilderWip();
      setDraft(newDraft());
      setStep("general");
    } catch (error) {
      setSaveError(formSaveErrorMessage(error, user?.email));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="form-builder-shell pb-8">
      <div className="form-builder-toolbar space-y-5">
        <WorkspacePageHeader
          bordered={false}
          title={draft.title || "New request form"}
          description="Build fields and print layout, then submit to Records for review."
          meta={
            <p className="font-mono text-xs text-muted-foreground">
              {draft.refNumber} · {draft.version}
            </p>
          }
        />

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {stepIdx + 1} of {FORM_BUILDER_STEPS.length}
            </span>
            <span>{FORM_BUILDER_STEPS[stepIdx].label}</span>
          </div>
          <Progress
            value={((stepIdx + 1) / FORM_BUILDER_STEPS.length) * 100}
            className="h-2 rounded-full"
          />
        </div>

        <ol className="wizard-step-track grid grid-cols-2 gap-x-3 gap-y-2.5 border-0 pb-0 sm:grid-cols-3 lg:grid-cols-6">
          {FORM_BUILDER_STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => goToStep(s.key)}
                  className={`group flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all ${
                    active
                      ? "border-primary/30 bg-primary/8 opacity-100 shadow-sm"
                      : "border-transparent opacity-80 hover:border-border/80 hover:bg-muted/35 hover:opacity-100"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-medium ${active ? "bg-primary text-primary-foreground shadow-sm" : done ? "bg-maroon/15 text-maroon" : "bg-muted text-muted-foreground"}`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span
                    className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
                  >
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div>
        {step === "general" && <GeneralStep draft={draft} update={update} />}
        {step === "fields" && <FieldsStep draft={draft} update={update} />}
        {step === "print" && <PrintTemplateStep draft={draft} update={update} />}
        {step === "clientApproval" && (
          <ClientRequestApprovalStep draft={draft} update={update} />
        )}
        {step === "processOwner" && (
          <ProcessOwnerApprovalStep draft={draft} update={update} />
        )}
        {step === "procedure" && <ProcedureStep draft={draft} update={update} />}
      </div>

      {saveError ? (
        <FlowNotice
          tone="danger"
          title="Could not save form"
          action={
            saveError.toLowerCase().includes("admin") ||
            saveError.toLowerCase().includes("forbidden") ||
            saveError.toLowerCase().includes("role") ? (
              <button
                type="button"
                className="text-xs font-medium underline"
                onClick={() => {
                  logout();
                  void navigate({ to: LOGIN, replace: true });
                }}
              >
                Sign out and switch account
              </button>
            ) : undefined
          }
        >
          {saveError}
        </FlowNotice>
      ) : null}

      <div className="mt-8 flex flex-col gap-4 border-t border-border/60 pt-7 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={stepIdx === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-sm transition-colors hover:bg-muted/35 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {stepIdx < FORM_BUILDER_STEPS.length - 1 ? (
          <div className="flex flex-col items-end gap-2">
            {stepBlockReason ? (
              <p className="max-w-xs text-right text-xs text-muted-foreground">{stepBlockReason}</p>
            ) : null}
            <button
              type="button"
              onClick={next}
              disabled={!!stepBlockReason}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={submitToRecords}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Submit to Records
            </button>
            <p className="max-w-xs text-right text-xs text-muted-foreground">
              Sends this form to Record Admin for review.{" "}
              <button
                type="button"
                onClick={saveDraft}
                disabled={isSaving}
                className="underline hover:text-foreground"
              >
                Save as draft instead
              </button>{" "}
              (drafts do not appear in Records).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
