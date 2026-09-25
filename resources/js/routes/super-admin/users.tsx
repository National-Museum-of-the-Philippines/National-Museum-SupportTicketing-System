import { createFileRoute } from "@tanstack/react-router";
import { RbacUsersPage } from "@/routes/admin/rbac/users";

export const Route = createFileRoute("/super-admin/users")({
  component: RbacUsersPage,
});
