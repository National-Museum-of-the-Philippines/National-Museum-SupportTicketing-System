import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Shared card modal chrome for form/ticket file viewers (Records, Client, Admin). */
export const DOCUMENT_VIEWER_DIALOG_CONTENT_CLASS =
  "flex max-h-[min(90vh,880px)] w-[min(100vw-1.5rem,52rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl border border-border/80 bg-background p-0 shadow-2xl sm:max-w-4xl";

type DocumentViewerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Optional banner under the header (warnings, auto-fill summary). */
  banner?: ReactNode;
  children: ReactNode;
  /** Extra classes on the inner document card. */
  cardClassName?: string;
};

/**
 * Centered card dialog — not fullscreen.
 * Puts the document inside a bordered card like Records / other views.
 */
export function DocumentViewerDialog({
  open,
  onOpenChange,
  title,
  description,
  banner,
  children,
  cardClassName,
}: DocumentViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DOCUMENT_VIEWER_DIALOG_CONTENT_CLASS}>
        <DialogHeader className="shrink-0 border-b border-border/80 px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="truncate text-base sm:text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {banner}

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 sm:p-5">
          <div
            className={cn(
              "overflow-visible rounded-xl border border-border/80 bg-card shadow-sm",
              cardClassName,
            )}
          >
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
