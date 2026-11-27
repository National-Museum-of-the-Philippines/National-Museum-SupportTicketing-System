import { createFileRoute } from "@tanstack/react-router";
import { CosUserManagementPage } from "@/components/admin/CosUserManagementPage";

export const Route = createFileRoute("/admin/user-management")({
  component: CosUserManagementPage,
});
