import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DataPanel, EmptyState, LoadingRows, StatusBadge } from "@/components/layout/workspace-ui";
import { RatingStars } from "@/components/tickets/RatingStars";
import { api } from "@/lib/api/client";
import type { PortalSlot } from "@/lib/sessions";

/**
 * Resolved and closed requests assigned to the signed-in person, with the
 * client's rating and comment, so the personnel sees feedback about their work.
 */
export function AssignedFeedbackPanel({ slot, canQuery }: { slot: PortalSlot; canQuery: boolean }) {
    // Finished work: the client's feedback about the service lands here.
    const { data: completedData, isLoading: completedLoading } = useQuery({
        queryKey: ["assigned-tickets", "completed", slot],
        queryFn: () => api.listAssignedTickets(slot, true),
        enabled: canQuery,
    });
    const completed = completedData?.items ?? [];
    const rated = completed.map((t) => t.feedbackRating ?? 0).filter((r) => r > 0);
    const average = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;

    return (
        <DataPanel
            title={`Client feedback on my completed work (${completed.filter((t) => t.feedbackSubmitted).length})`}
            description={
                average != null
                    ? `Average rating ${average.toFixed(1)} out of 5 from ${rated.length} rating${rated.length === 1 ? "" : "s"}.`
                    : "Resolved and closed requests assigned to you, with what the client said."
            }
        >
            <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                    <thead className="text-left">
                        <tr>
                            <th className="px-4 py-3 sm:px-5">Ticket</th>
                            <th className="px-4 py-3 sm:px-5">Client</th>
                            <th className="px-4 py-3 sm:px-5">Status</th>
                            <th className="px-4 py-3 sm:px-5">Rating</th>
                            <th className="px-4 py-3 sm:px-5">Comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!canQuery || completedLoading ? (
                            <LoadingRows cols={5} />
                        ) : completed.length === 0 ? (
                            <tr>
                                <td colSpan={5}>
                                    <EmptyState
                                        title="No completed work yet"
                                        description="Once the client marks a service complete and sends feedback, it appears here."
                                    />
                                </td>
                            </tr>
                        ) : (
                            completed.map((t) => (
                                <tr key={t._id} className="border-t border-border/70 align-top">
                                    <td className="px-4 py-3.5 sm:px-5">
                                        <Link
                                            to={
                                                slot === "admin"
                                                    ? "/admin/requests/$ticketId"
                                                    : "/client/requests/$ticketId"
                                            }
                                            params={{ ticketId: t._id }}
                                            className="font-medium text-maroon hover:underline"
                                        >
                                            {t.ticketNumber}
                                        </Link>
                                        <p className="text-xs text-muted-foreground">
                                            {t.formTitle}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3.5 sm:px-5">{t.creatorName}</td>
                                    <td className="px-4 py-3.5 sm:px-5">
                                        <StatusBadge status={t.status} />
                                    </td>
                                    <td className="px-4 py-3.5 sm:px-5">
                                        {t.feedbackRating ? (
                                            <RatingStars rating={t.feedbackRating} />
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="max-w-md px-4 py-3.5 sm:px-5">
                                        {t.feedbackSubmitted ? (
                                            <p className="whitespace-pre-wrap">
                                                {t.feedbackComment?.trim() || "No written comment."}
                                            </p>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Waiting for the client's feedback
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </DataPanel>
    );
}
