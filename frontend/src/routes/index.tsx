import { createFileRoute, redirect } from "@tanstack/react-router";
import { LOGIN } from "@/lib/navigation";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: LOGIN, replace: true });
  },
});
