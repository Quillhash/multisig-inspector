import { SiteHeader } from "@/components/safe-inspector/site-header";
import { HacksTimeline } from "./hacks-timeline";

export function HacksPage() {
  return (
    <div className="min-h-screen pb-28 text-foreground">
      <SiteHeader active="hacks" />

      <section className="page-enter border-b border-white/60">
        <div className="mx-auto max-w-[1100px] px-5 py-10 lg:px-6">
          <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-accent uppercase">
            QuillAudits · Multisig inspector
          </p>
          <h1 className="mt-3 text-[clamp(1.75rem,3.2vw,2.35rem)] leading-[1.08] font-bold tracking-tight text-pretty">
            Multisig hack timeline
          </h1>
          <p className="mt-3 max-w-[64ch] text-[0.92rem] leading-relaxed text-muted text-pretty">
            Real multisig incidents and how independent decoding, hash
            verification, and Safe configuration scanning could have prevented
            them. Scroll to watch the counter tick down.
          </p>
        </div>
      </section>

      <main className="page-enter-delay-1 mx-auto max-w-[1100px] px-5 py-10 lg:px-6">
        <HacksTimeline />
      </main>
    </div>
  );
}
