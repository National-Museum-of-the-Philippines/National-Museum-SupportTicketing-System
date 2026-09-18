import type { ReactNode } from "react";

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
  /** Softer motion for full-screen pages like login */
  variant?: "default" | "soft";
};

export function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={className}>{children}</div>;
}
