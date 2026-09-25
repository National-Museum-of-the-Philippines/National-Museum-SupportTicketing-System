import { createFileRoute } from "@tanstack/react-router";
import { ClientSubmitForm } from "@/components/client/ClientSubmitForm";
import { BackLink } from "@/components/layout/workspace-ui";
import { CLIENT_REQUESTS } from "@/lib/navigation";

export const Route = createFileRoute("/client/submit")({
  validateSearch: (s: Record<string, unknown>) => ({
    formId: typeof s.formId === "string" ? s.formId : undefined,
  }),
  component: ClientSubmitPage,
});

function ClientSubmitPage() {
  const { formId } = Route.useSearch();
  return (
    <div className="page-shell">
      <BackLink to={CLIENT_REQUESTS} label="Back to my requests" />
      <ClientSubmitForm initialFormId={formId} />
    </div>
  );
}
