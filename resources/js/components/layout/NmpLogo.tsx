import { cn } from "@/lib/utils";

type NmpLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-28 w-28",
};

export function NmpLogo({ className, size = "md" }: NmpLogoProps) {
  return (
    <img
      src="/nmp-logo.png"
      alt="Pambansang Museo ng Pilipinas"
      className={cn("mx-auto object-contain", sizes[size], className)}
    />
  );
}
