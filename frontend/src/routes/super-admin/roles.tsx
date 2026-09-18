import { createFileRoute } from "@tanstack/react-router";
import { RbacRolesPage } from "@/routes/admin/rbac/roles";

export const Route = createFileRoute("/super-admin/roles")({
  component: RbacRolesPage,
});
