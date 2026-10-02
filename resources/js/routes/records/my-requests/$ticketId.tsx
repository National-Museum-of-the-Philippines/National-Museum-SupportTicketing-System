import { createFileRoute } from "@tanstack/react-router";
import { MyRequestDetailPage } from "@/components/tickets/MyRequestDetailPage";
import { RECORDS_MY_REQUESTS } from "@/lib/navigation";
import { useRecordsSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/records/my-requests/$ticketId")({
  component: Page,
});

function Page() {
  const { ticketId } = Route.useParams();
  const { canQuery } = useRecordsSession();
  return (
    <MyRequestDetailPage
      slot="records"
      ticketId={ticketId}
      canQuery={canQuery}
      backPath={RECORDS_MY_REQUESTS}
    />
  );
}
