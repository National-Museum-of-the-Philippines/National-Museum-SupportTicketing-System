import { createFileRoute } from "@tanstack/react-router";
import { MyRequestsListPage } from "@/components/tickets/MyRequestsListPage";
import { SUPER_ADMIN_MY_REQUESTS_SUBMIT } from "@/lib/navigation";
import { useAdminSession } from "@/lib/use-portal-session";

export const Route = createFileRoute("/super-admin/my-requests/")({
  component: Page,
});

function Page() {
  const { canQuery } = useAdminSession();
  return (
    <MyRequestsListPage
      slot="admin"
      canQuery={canQuery}
      submitPath={SUPER_ADMIN_MY_REQUESTS_SUBMIT}
      detailPath={(ticketId) => `/super-admin/my-requests/${ticketId}`}
    />
  );
}
