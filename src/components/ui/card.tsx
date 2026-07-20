import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "glass-panel rounded-[12px] border",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHead({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-0 text-[0.8rem] font-bold tracking-[0.06em] text-foreground uppercase">
      {children}
    </div>
  );
}
