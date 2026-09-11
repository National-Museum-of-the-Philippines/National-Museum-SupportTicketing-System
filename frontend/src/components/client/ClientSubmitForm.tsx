import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ActionPanel,
  DataPanel,
  EmptyState,
  FlowNotice,
  FormSelect,
  PanelLoading,
  WorkspacePageHeader,
} from "@/components/layout/workspace-ui";
import { ClientFieldInput } from "@/components/client/ClientFieldInput";
import { ClientFormFileViewerDialog } from "@/components/client/ClientFormFileViewerDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";
import type { FormRecord, LiveFormField } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { fieldHasAnswer } from "@/lib/form-field-values";
import { CLIENT_REQUESTS } from "@/lib/navigation";
import { mergeRequesterProfileIntoAnswers } from "@/lib/profile-placement-fields";
import { dataUrlToFile } from "@/lib/upload-data-url";
import { isAllowedUpload, MAX_UPLOAD_MB, uploadTooLarge } from "@/lib/upload-limits";

const SUBMIT_ANSWERS_PREFIX = "nmp-submit-answers:";

function submitAnswersKey(formId: string, userId?: string) {
  return `${SUBMIT_ANSWERS_PREFIX}${userId ?? "anon"}:${formId}`;
}

function loadSubmitAnswers(formId: string, userId?: string): Record<string, unknown> | null {
  if (typeof sessionStorage === "undefined" || !formId) return null;
  try {
    const raw = sessionStorage.getItem(submitAnswersKey(formId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function saveSubmitAnswers(formId: string, userId: string | undefined, answers: Record<string, unknown>) {
  if (typeof sessionStorage === "undefined" || !formId) return;
  try {
    sessionStorage.setItem(submitAnswersKey(formId, userId), JSON.stringify(answers));
  } catch {
    // Quota exceeded — keep in-memory answers only.
  }
}

function clearSubmitAnswers(formId: string, userId?: string) {
  if (typeof sessionStorage === "undefined" || !formId) return;
  sessionStorage.removeItem(submitAnswersKey(formId, userId));
}

type ClientSubmitFormProps = {
  initialFormId?: string;
  /** Where to go after a successful submit (defaults to client My Requests). */
  successTo?: string;
};

async function prepareAnswersForSubmit(
  fields: LiveFormField[],
  fieldAnswers: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const prepared = { ...fieldAnswers };

  for (const field of fields) {
    if (field.type !== "signature") continue;
    const value = prepared[field.variable];
    if (typeof value !== "string" || !value.startsWith("data:image/")) continue;

    const file = await dataUrlToFile(
      value,
      `signature-${field.variable.replace(/\W/g, "") || "field"}`,
    );
    const { file: uploaded } = await api.uploadFile(file);
    prepared[field.variable] = uploaded.url;
  }

  return prepared;
}

export function ClientSubmitForm({
  initialFormId,
  successTo = CLIENT_REQUESTS,
}: ClientSubmitFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFormId, setSelectedFormId] = useState(initialFormId ?? "");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [uploading, setUploading] = useState(false);
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const restoredForForm = useRef<string | null>(null);
  const profileAppliedFor = useRef<string | null>(null);

  const { data: formsData, isLoading: formsLoading } = useQuery({
    queryKey: ["published-forms"],
    queryFn: () => api.publishedForms(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const forms = formsData?.items ?? [];

  const { data: formData, isLoading: formLoading } = useQuery({
    queryKey: ["published-form", selectedFormId],
    queryFn: () => api.getPublishedForm(selectedFormId),
    enabled: Boolean(selectedFormId),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { data: requesterData, isLoading: requesterLoading } = useQuery({
    queryKey: ["requester-profile", "client", user?.id],
    queryFn: () => api.requesterProfile("client"),
    enabled: Boolean(user?.id),
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (initialFormId) setSelectedFormId(initialFormId);
  }, [initialFormId]);

  // Restore in-progress answers first so a remount does not wipe the fill.
  useEffect(() => {
    if (!selectedFormId) return;
    if (restoredForForm.current === selectedFormId) return;
    restoredForForm.current = selectedFormId;
    const saved = loadSubmitAnswers(selectedFormId, user?.id);
    if (saved && Object.keys(saved).length > 0) {
      profileAppliedFor.current = user?.id ?? "restored";
      setAnswers(saved);
    }
  }, [selectedFormId, user?.id]);

  useEffect(() => {
    if (!selectedFormId || restoredForForm.current !== selectedFormId) return;
    if (Object.keys(answers).length === 0) return;
    saveSubmitAnswers(selectedFormId, user?.id, answers);
  }, [answers, selectedFormId, user?.id]);

  // Apply PAMANA profile once — do not re-merge on every refetch (that fights typing).
  useEffect(() => {
    if (!requesterData?.found || !requesterData.values || !user?.id) return;
    if (profileAppliedFor.current === user.id) return;
    const values = requesterData.values;
    const hasData = Object.values(values).some((v) => String(v ?? "").trim() !== "");
    if (!hasData) return;
    profileAppliedFor.current = user.id;
    setAnswers((prev) => ({ ...prev, ...values }));
  }, [requesterData, user?.id]);

  const form = formData?.form;

  const requesterProfile = useMemo(() => {
    // Prefer PAMANA hit for the requesting client.
    if (requesterData?.found && requesterData.profile) {
      const p = requesterData.profile;
      return {
        name: p.name,
        email: p.email,
        division: p.division,
        designation: p.designation,
        firstName: p.firstName,
        middleName: p.middleName,
        lastName: p.lastName,
      };
    }
    // Fallback: enriched /me fields (also PAMANA-backed when available).
    if (!user) return null;
    return {
      name: user.name,
      email: user.email,
      division: user.division,
      designation: user.designation,
      firstName: user.firstName ?? "",
      middleName: user.middleName ?? "",
      lastName: user.lastName ?? "",
    };
  }, [requesterData, user]);

  const previewAnswers = useMemo(() => {
    const merged = requesterProfile
      ? mergeRequesterProfileIntoAnswers(requesterProfile, answers)
      : answers;
    // Guaranteed {{prof_*}} keys from PAMANA when the client was matched.
    if (requesterData?.found && requesterData.values) {
      return { ...merged, ...requesterData.values };
    }
    return merged;
  }, [requesterProfile, answers, requesterData?.found, requesterData?.values]);

  const profileSummary = useMemo(() => {
    if (!requesterProfile && !requesterData?.values) return null;
    const values = requesterData?.values ?? mergeRequesterProfileIntoAnswers(requesterProfile ?? {}, {});
    return {
      division: String(values["{{prof_division}}"] || "—"),
      first: String(values["{{prof_first}}"] || "—"),
      middle: String(values["{{prof_middle}}"] || "—"),
      last: String(values["{{prof_last}}"] || "—"),
      email: String(values["{{prof_email}}"] || "—"),
      designation: String(values["{{prof_designation}}"] || "—"),
      fromPamana: requesterData?.found === true,
    };
  }, [requesterProfile, requesterData]);

  const submitMutation = useMutation({
    mutationFn: async ({
      form: f,
      fieldAnswers,
    }: {
      form: FormRecord;
      fieldAnswers: Record<string, unknown>;
    }) => {
      const prepared = await prepareAnswersForSubmit(f.fields, fieldAnswers);
      const fresh = await api.requesterProfile("client");
      if (!fresh.found) {
        throw new Error(
          "No PAMANA employee record found for your login. Sign in with your museum username so requestor details can auto-fill.",
        );
      }
      const answersPayload = {
        ...prepared,
        ...fresh.values,
      };
      return api.createTicket(
        {
          formId: f._id,
          answers: answersPayload,
        },
        "client",
      );
    },
    onSuccess: (res) => {
      toast.success("Request submitted", {
        description: `Ticket ${res.ticket.ticketNumber} is pending admin approval.`,
      });
      if (selectedFormId) clearSubmitAnswers(selectedFormId, user?.id);
      restoredForForm.current = null;
      profileAppliedFor.current = null;
      setAnswers({});
      void queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      void navigate({ to: successTo });
    },
    onError: (err: Error) => toast.error(err.message || "Submission failed"),
  });

  const setField = (variable: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [variable]: value }));
  };

  const handleFieldFileUpload = async (field: LiveFormField, file: File) => {
    if (!isAllowedUpload(file.name, file.type)) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    if (uploadTooLarge(file.size)) {
      toast.error(`File is too large (max ${MAX_UPLOAD_MB} MB).`);
      return;
    }
    setUploading(true);
    try {
      const { file: uploaded } = await api.uploadFile(file);
      setField(field.variable, uploaded.url);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (formsLoading && !formsData) {
    return <PanelLoading label="Loading available forms…" />;
  }

  if (forms.length === 0) {
    return (
      <>
        <WorkspacePageHeader
          title="Submit Request"
          description={`Submitting as ${user?.name ?? user?.email ?? "your account"}.`}
          bordered
        />
        <DataPanel title="Available forms">
          <EmptyState
            title="No forms available."
            description="Published TA forms will appear here when Records approves them."
          />
        </DataPanel>
      </>
    );
  }

  return (
    <>
      <WorkspacePageHeader
        title="Submit Request"
        description={`Submitting as ${user?.name ?? user?.email ?? "your account"}. This request will appear in your list only.`}
        bordered
      />

      <ActionPanel title="Choose a form" description="Select a published TA form, then complete the fields below.">
        <div className="space-y-2">
          <Label>Published form</Label>
          <FormSelect
            value={selectedFormId}
            onChange={(e) => {
              setSelectedFormId(e.target.value);
              restoredForForm.current = null;
              profileAppliedFor.current = null;
              // Keep PAMANA profile fields when switching forms.
              setAnswers(() => {
                if (!requesterData?.found || !requesterData.values) return {};
                return { ...requesterData.values };
              });
            }}
          >
            <option value="">Select a form…</option>
            {forms.map((f) => (
              <option key={f._id} value={f._id}>
                {f.title}
              </option>
            ))}
          </FormSelect>
        </div>

        {selectedFormId && formLoading && !form ? (
          <PanelLoading label="Loading form fields…" />
        ) : form ? (
          <>
            {form.printTemplateImagePath?.trim() ? (
              <FlowNotice tone="info" title="Review the TA form">
                Open the uploaded template before filling in your request fields. Requestor details
                are filled automatically from your account.
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-sm"
                    onClick={() => setFilePreviewOpen(true)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View form file
                  </Button>
                </div>
              </FlowNotice>
            ) : null}

            {requesterLoading ? (
              <FlowNotice tone="info" title="Loading requestor details…">
                Fetching employee profile from PAMANA…
              </FlowNotice>
            ) : profileSummary ? (
              <FlowNotice
                tone={profileSummary.fromPamana ? "success" : "warning"}
                title="Your requestor details (auto-filled)"
              >
                <div className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Division/Section:</span>{" "}
                    {profileSummary.division}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Designation:</span>{" "}
                    {profileSummary.designation}
                  </p>
                  <p>
                    <span className="text-muted-foreground">First name:</span> {profileSummary.first}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Middle initial:</span>{" "}
                    {profileSummary.middle}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Last name:</span> {profileSummary.last}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Email:</span> {profileSummary.email}
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {profileSummary.fromPamana
                    ? "Filled from pamana_employees_new.staffinformations + staffs for your login."
                    : "No PAMANA employee record found for this login. Sign in with your museum username (e.g. resty.morancil) so requestor details auto-fill on the TA form."}
                </p>
              </FlowNotice>
            ) : null}

            <form
              className="space-y-5 border-t border-border/70 pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const current = answersRef.current;
                const hasValue = form.fields.some((field) =>
                  fieldHasAnswer(field, current[field.variable]),
                );
                if (!hasValue) {
                  toast.error("Fill in at least one field before submitting.");
                  return;
                }
                submitMutation.mutate({ form, fieldAnswers: { ...current } });
              }}
            >
              {form.fields.map((field) => (
                <ClientFieldInput
                  key={field.id}
                  field={field}
                  value={answers[field.variable]}
                  onChange={(v) => setField(field.variable, v)}
                  onFile={
                    field.type === "file" ? (file) => handleFieldFileUpload(field, file) : undefined
                  }
                  uploading={uploading}
                />
              ))}
              <Button type="submit" disabled={submitMutation.isPending} className="shadow-sm">
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit request"
                )}
              </Button>
            </form>

            <ClientFormFileViewerDialog
              formId={form._id}
              formTitle={form.title}
              refNumber={form.refNumber}
              answers={previewAnswers}
              open={filePreviewOpen}
              onOpenChange={setFilePreviewOpen}
            />
          </>
        ) : null}
      </ActionPanel>
    </>
  );
}
