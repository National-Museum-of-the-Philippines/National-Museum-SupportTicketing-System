import { createFileRoute } from "@tanstack/react-router";
import { DynamicFormReport } from "@/components/form-report/DynamicFormReport";
import { ensureAdminOnly } from "@/lib/admin-only-guard";

export const Route = createFileRoute("/admin/reports")({
  beforeLoad: () => ensureAdminOnly(),
  component: DynamicFormReport,
});
