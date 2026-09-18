import { createFileRoute, redirect } from "@tanstack/react-router";
import { CLIENT_DASHBOARD } from "@/lib/navigation";

export const Route = createFileRoute("/client/forms")({
  beforeLoad: () => {
    throw redirect({ to: CLIENT_DASHBOARD, replace: true });
  },
});
