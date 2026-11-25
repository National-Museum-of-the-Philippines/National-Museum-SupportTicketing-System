import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only 1–5 star rating. Renders nothing when there is no rating. */
export function RatingStars({ rating, className }: { rating?: number | null; className?: string }) {
    const value = Math.round(rating ?? 0);
    if (value < 1) return null;
    return (
        <span
            className={cn("inline-flex gap-0.5", className)}
            role="img"
            aria-label={`${value} out of 5 stars`}
        >
            {[1, 2, 3, 4, 5].map((n) => (
                <Star
                    key={n}
                    className={cn(
                        "h-4 w-4",
                        n <= value ? "fill-amber-500 text-amber-500" : "text-amber-500/40",
                    )}
                />
            ))}
        </span>
    );
}
