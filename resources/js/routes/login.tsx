import { createFileRoute } from "@tanstack/react-router";
import { UnifiedLoginPage } from "@/components/auth/UnifiedLoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — Support Ticketing System" }] }),
  component: UnifiedLoginPage,
});
