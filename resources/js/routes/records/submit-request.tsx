import { createFileRoute } from "@tanstack/react-router";
import { ClientSubmitForm } from "@/components/client/ClientSubmitForm";
import { BackLink } from "@/components/layout/workspace-ui";
import { RECORDS_MY_REQUESTS } from "@/lib/navigation";

export const Route = createFileRoute("/records/submit-request")({
  validateSearch: (s: Record<string, unknown>) => ({
    formId: typeof s.formId === "string" ? s.formId : undefined,
  }),
  component: RecordsSubmitRequestPage,
});

function RecordsSubmitRequestPage() {
  const { formId } = Route.useSearch();
  return (
    <div className="page-shell">
      <BackLink to={RECORDS_MY_REQUESTS} label="Back to my requests" />
      <ClientSubmitForm initialFormId={formId} successTo={RECORDS_MY_REQUESTS} />
    </div>
  );
}
