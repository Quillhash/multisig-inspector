"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  HACKS,
  groupByYear,
  totalLossUsd,
  verdictCounts,
  formatUsdCompact,
  type HackIncident,
  type HelpVerdict,
} from "./hacks-data";

function verdictLabel(verdict: HelpVerdict) {
  switch (verdict) {
    case "yes":
      return "Could have helped";
    case "partially":
      return "Could have helped partially";
    case "no":
      return "Out of scope";
  }
}

function verdictColor(verdict: HelpVerdict) {
  switch (verdict) {
    case "yes":
      return {
        border: "border-l-success!",
        badge: "bg-success-soft text-success",
        dot: "bg-success",
      };
    case "partially":
      return {
        border: "border-l-warning!",
        badge: "bg-warning-soft text-warning",
        dot: "bg-warning",
      };
    case "no":
      return {
        border: "border-l-muted-faint!",
        badge: "bg-muted/10 text-muted",
        dot: "bg-muted",
      };
  }
}

export function HacksTimeline() {
  const [runningLoss, setRunningLoss] = useState(0);
  const grouped = useMemo(() => groupByYear(HACKS), []);
  const total = useMemo(() => totalLossUsd(), []);
  const counts = useMemo(() => verdictCounts(), []);

  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const onScroll = () => {
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.body.scrollHeight - 50;
      const next = HACKS.reduce((sum, hack, i) => {
        const el = itemRefs.current[i];
        if (!el) return sum;
        const rect = el.getBoundingClientRect();
        if (rect.top < 0 || atBottom) {
          return sum + hack.lossUsd;
        }
        return sum;
      }, 0);
      setRunningLoss(next);
    };

    // Coalesce scroll events to one measurement per frame.
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        onScroll();
      });
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  let refIndex = 0;

  return (
    <div className="relative">
      <div className="space-y-14">
        {grouped.map(([year, incidents]) => (
          <section key={year} className="relative">
            <div className="mb-6 flex items-center gap-4">
              <span className="inline-flex h-10 w-16 items-center justify-center rounded-full border border-rule bg-surface text-sm font-bold text-foreground shadow-sm">
                {year}
              </span>
              <div className="h-px flex-1 bg-rule" />
            </div>

            <div className="relative space-y-8 pl-6 lg:pl-8">
              <div className="absolute top-2 bottom-2 left-[11px] w-px bg-rule-strong lg:left-[13px]" />

              {incidents.map((hack) => {
                const globalIndex = refIndex++;
                return (
                  <IncidentCard
                    key={hack.id}
                    hack={hack}
                    ref={(el) => {
                      itemRefs.current[globalIndex] = el;
                    }}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <GriftCounter running={runningLoss} total={total} counts={counts} />
    </div>
  );
}

function IncidentCard({
  hack,
  ref,
}: {
  hack: HackIncident;
  ref?: (el: HTMLDivElement | null) => void;
}) {
  const colors = verdictColor(hack.verdict);

  return (
    <article
      ref={ref}
      data-id={hack.id}
      className={cn(
        "glass-panel relative border border-l-4 p-5 lg:p-6",
        colors.border,
      )}
    >
      <span
        className={cn(
          "absolute -left-[21px] top-6 h-3.5 w-3.5 rounded-full border-2 border-surface shadow-sm lg:-left-[25px]",
          colors.dot,
        )}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <time dateTime={hack.date} className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-faint">
            {hack.date}
          </time>
          <h2 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight">
            {hack.name}
          </h2>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <span className="text-[1.6rem] font-bold leading-none text-critical">
            {hack.lossDisplay}
          </span>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-faint">
            lost
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide",
              colors.badge,
            )}
          >
            {verdictLabel(hack.verdict)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-faint">
            Attack vector
          </p>
          <p className="mt-1 text-[0.9rem] leading-relaxed text-muted">
            {hack.vector}
          </p>
        </div>
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-faint">
            Would the tool have helped?
          </p>
          <p className="mt-1 text-[0.9rem] leading-relaxed text-foreground">
            {hack.verdictCopy}
          </p>
        </div>
      </div>
    </article>
  );
}

function GriftCounter({
  running,
  total,
  counts,
}: {
  running: number;
  total: number;
  counts: Record<HelpVerdict, number>;
}) {
  const remaining = Math.max(total - running, 0);

  return (
    <div className="fixed bottom-5 left-5 z-40 w-[min(16rem,calc(100vw-2.5rem))]">
      <div className="glass-panel border p-4 !shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-critical-soft text-critical">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-faint">
              Total left
            </p>
            <p className="text-[1.25rem] font-bold leading-none text-foreground">
              {formatUsdCompact(remaining)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-faint">
          <span className="text-success">{counts.yes} yes</span>
          <span className="text-warning">{counts.partially} partial</span>
          <span>{counts.no} out of scope</span>
        </div>
      </div>
    </div>
  );
}
