import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Switch({
  checked,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "aria-checked"> & {
  checked: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full p-0 transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-accent" : "bg-rule-strong",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 left-0.5 block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}
