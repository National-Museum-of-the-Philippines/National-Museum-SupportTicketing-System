import { createFileRoute } from "@tanstack/react-router";
import { ClientStageReviewPage } from "@/components/tickets/ClientStageReviewPage";

export const Route = createFileRoute("/client/for-review-supervisor")({
  component: SupervisorReviewPage,
});

function SupervisorReviewPage() {
  return <ClientStageReviewPage stage="supervisor" />;
}
