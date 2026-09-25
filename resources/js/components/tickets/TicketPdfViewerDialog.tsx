import { useQuery } from "@tanstack/react-query";
import { DocumentViewerDialog } from "@/components/documents/DocumentViewerDialog";
import { TicketSubmittedFileViewer } from "@/components/tickets/TicketSubmittedFileViewer";
import { api } from "@/lib/api/client";
import type { PortalSlot } from "@/lib/sessions";

type TicketPdfViewerDialogProps = {
  ticketId: string | null;
  ticketNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot?: PortalSlot;
};

export function TicketPdfViewerDialog({
  ticketId,
  ticketNumber,
  open,
  onOpenChange,
  slot = "admin",
}: TicketPdfViewerDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ticket", ticketId, slot],
    queryFn: () => api.getTicket(ticketId!, slot),
    enabled: open && Boolean(ticketId),
  });

  const ticket = data?.ticket;

  return (
    <DocumentViewerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={ticketNumber ? `${ticketNumber} — Request file` : "Request file"}
      description="Submitted form with answers, plus any supporting document when uploaded. Scroll to review before approving. View only."
    >
      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading file…</p>
      ) : isError || !ticket ? (
        <p className="py-16 text-center text-sm text-destructive">Could not load file.</p>
      ) : (
        <TicketSubmittedFileViewer ticket={ticket} enabled={open} slot={slot} />
      )}
    </DocumentViewerDialog>
  );
}
