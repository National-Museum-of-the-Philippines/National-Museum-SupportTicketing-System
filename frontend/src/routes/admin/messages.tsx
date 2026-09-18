import { createFileRoute } from "@tanstack/react-router";
import { MessengerPage } from "@/components/messages/MessengerPage";

export const Route = createFileRoute("/admin/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    ticket: typeof search.ticket === "string" ? search.ticket : undefined,
    conversation: typeof search.conversation === "string" ? search.conversation : undefined,
  }),
  component: AdminMessagesPage,
});

function AdminMessagesPage() {
  const { ticket, conversation } = Route.useSearch();
  return (
    <MessengerPage slot="admin" initialTicketId={ticket} initialConversationId={conversation} />
  );
}
