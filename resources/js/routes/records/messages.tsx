import { createFileRoute, redirect } from "@tanstack/react-router";
import { RECORDS_DASHBOARD } from "@/lib/navigation";

/** Messages are not available in the Records portal. */
export const Route = createFileRoute("/records/messages")({
  beforeLoad: () => {
    throw redirect({ to: RECORDS_DASHBOARD, replace: true });
  },
});
