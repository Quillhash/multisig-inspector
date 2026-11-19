import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-accent text-white hover:bg-accent-hover",
        variant === "secondary" &&
          "glass-btn-secondary border text-foreground",
        variant === "ghost" &&
          "border border-rule text-muted hover:bg-accent-soft",
        variant === "danger" &&
          "border border-critical-border bg-critical-soft text-critical hover:bg-critical-soft/80",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
