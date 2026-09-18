import { createFileRoute } from "@tanstack/react-router";
import { ActionOfficerReviewPage } from "@/components/tickets/ActionOfficerReviewPage";

export const Route = createFileRoute("/client/for-review-action-officer")({
  component: ActionOfficerClientPage,
});

function ActionOfficerClientPage() {
  return <ActionOfficerReviewPage />;
}
