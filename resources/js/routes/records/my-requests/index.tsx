import { createFileRoute } from "@tanstack/react-router";
import { MyRequestsListPage } from "@/components/tickets/MyRequestsListPage";
import { RECORDS_MY_REQUESTS_SUBMIT } from "@/lib/navigation";
import { useRecordsSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/records/my-requests/")({
  component: Page,
});

function Page() {
  const { canQuery } = useRecordsSession();
  return (
    <MyRequestsListPage
      slot="records"
      canQuery={canQuery}
      submitPath={RECORDS_MY_REQUESTS_SUBMIT}
      detailPath={(ticketId) => `/records/my-requests/${ticketId}`}
    />
  );
}
