import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/25 bg-gradient-to-b from-primary to-[color-mix(in_oklch,var(--maroon-deep)_88%,var(--maroon))] text-primary-foreground shadow-md shadow-[color-mix(in_oklab,var(--maroon)_24%,transparent)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[color-mix(in_oklab,var(--maroon)_32%,transparent)] hover:brightness-[1.03] active:translate-y-0 active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:-translate-y-0.5 hover:shadow-lg hover:bg-destructive/92 active:translate-y-0 active:scale-[0.98]",
        outline:
          "border border-input bg-background shadow-sm hover:-translate-y-0.5 hover:border-maroon/30 hover:bg-accent hover:text-accent-foreground hover:shadow-md active:translate-y-0",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary/85 hover:shadow-md active:translate-y-0",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
