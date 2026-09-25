import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/routes/admin/reports";

export const Route = createFileRoute("/super-admin/reports")({
  component: ReportsPage,
});
