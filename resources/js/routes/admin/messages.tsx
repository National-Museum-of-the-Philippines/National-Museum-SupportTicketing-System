import { createFileRoute, redirect } from "@tanstack/react-router";
import { openMessenger } from "@/lib/messenger-store";
import { ADMIN_DASHBOARD } from "@/lib/navigation";

/**
 * Messages live in the floating chat window. This route stays so old links and
 * bookmarks still work: it opens the chat and lands on the dashboard.
 */
export const Route = createFileRoute("/admin/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    ticket: typeof search.ticket === "string" ? search.ticket : undefined,
    conversation: typeof search.conversation === "string" ? search.conversation : undefined,
  }),
  beforeLoad: ({ search }) => {
    openMessenger({ ticketId: search.ticket, conversationId: search.conversation });
    throw redirect({ to: ADMIN_DASHBOARD, replace: true });
  },
});
