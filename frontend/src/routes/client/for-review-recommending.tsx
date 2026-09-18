import { createFileRoute } from "@tanstack/react-router";
import { ClientStageReviewPage } from "@/components/tickets/ClientStageReviewPage";

export const Route = createFileRoute("/client/for-review-recommending")({
  component: RecommendingReviewPage,
});

function RecommendingReviewPage() {
  return <ClientStageReviewPage stage="recommending" />;
}
