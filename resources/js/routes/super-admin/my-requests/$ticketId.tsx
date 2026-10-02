import { createFileRoute } from "@tanstack/react-router";
import { MyRequestDetailPage } from "@/components/tickets/MyRequestDetailPage";
import { SUPER_ADMIN_MY_REQUESTS, ADMIN_MESSAGES } from "@/lib/navigation";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/super-admin/my-requests/$ticketId")({
  component: Page,
});

function Page() {
  const { ticketId } = Route.useParams();
  const { canQuery } = useAdminSession();
  return (
    <MyRequestDetailPage
      slot="admin"
      ticketId={ticketId}
      canQuery={canQuery}
      backPath={SUPER_ADMIN_MY_REQUESTS}
      messagesPath={ADMIN_MESSAGES}
    />
  );
}
