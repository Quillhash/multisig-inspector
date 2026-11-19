import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Brand button: always a fully round pill. Compact (40px) by default, which
 * suits app screens; pass `size="lg"` for the 60px marketing size.
 */
export function Button({
  children,
  className,
  variant = "primary",
  size = "sm",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "lg";
}) {
  return (
    <button
      className={cn(
        "qa-btn gap-2",
        size === "sm" && "qa-btn--sm",
        (variant === "secondary" || variant === "ghost") && "qa-btn--glass",
        variant === "danger" &&
          "border border-critical-border bg-critical-soft text-critical hover:bg-critical-soft",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
