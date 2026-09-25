import { createFileRoute } from "@tanstack/react-router";
import { FormBuilderWizard } from "@/components/form-builder";
import { ensureAdminOnly } from "@/lib/admin-only-guard";

export const Route = createFileRoute("/admin/forms")({
  beforeLoad: () => ensureAdminOnly(),
  component: () => <FormBuilderWizard />,
});
