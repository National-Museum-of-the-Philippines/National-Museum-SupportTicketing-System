import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground hover:border-maroon/25 focus-visible:border-maroon/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/15 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
