import { createFileRoute, redirect } from "@tanstack/react-router";
import { ADMIN_DASHBOARD } from "@/lib/navigation";

/** @deprecated — use /admin */
export const Route = createFileRoute("/user")({
  beforeLoad: () => {
    throw redirect({ to: ADMIN_DASHBOARD, replace: true });
  },
});
