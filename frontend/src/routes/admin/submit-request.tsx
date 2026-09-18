import { createFileRoute } from "@tanstack/react-router";
import { ClientSubmitForm } from "@/components/client/ClientSubmitForm";
import { BackLink } from "@/components/layout/workspace-ui";
import { ADMIN_MY_REQUESTS } from "@/lib/navigation";

export const Route = createFileRoute("/admin/submit-request")({
  validateSearch: (s: Record<string, unknown>) => ({
    formId: typeof s.formId === "string" ? s.formId : undefined,
  }),
  component: AdminSubmitRequestPage,
});

function AdminSubmitRequestPage() {
  const { formId } = Route.useSearch();
  return (
    <div className="page-shell">
      <BackLink to={ADMIN_MY_REQUESTS} label="Back to my requests" />
      <ClientSubmitForm initialFormId={formId} successTo={ADMIN_MY_REQUESTS} />
    </div>
  );
}
