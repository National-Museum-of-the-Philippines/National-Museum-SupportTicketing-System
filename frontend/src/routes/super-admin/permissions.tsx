import { createFileRoute } from "@tanstack/react-router";
import { RbacPermissionsPage } from "@/routes/admin/rbac/permissions";

export const Route = createFileRoute("/super-admin/permissions")({
  component: RbacPermissionsPage,
});
