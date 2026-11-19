import { SiteHeader } from "@/components/safe-inspector/site-header";
import { HACKS, formatUsdCompact, totalLossUsd } from "./hacks-data";
import { HacksTimeline } from "./hacks-timeline";

export function HacksPage() {
  return (
    <div className="text-foreground">
      <SiteHeader active="hacks" />

      <section className="hero-ink">
        <div className="page-enter mx-auto max-w-[1200px] px-5 py-12 lg:px-6">
          <p className="eyebrow">Incident timeline</p>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(1.9rem,4.2vw,2.9rem)] leading-[1.06] font-semibold tracking-[-0.03em] text-balance">
            Multisig hacks and <span className="hero-accent">what would have stopped them</span>
          </h1>
          <p className="mt-4 max-w-[64ch] text-base leading-relaxed text-white/70 text-pretty">
            {HACKS.length} real multisig incidents worth {formatUsdCompact(totalLossUsd())} in
            losses, with the attack vector for each and an honest verdict on
            whether independent decoding, hash verification or a Safe
            configuration scan could have prevented it.
          </p>
        </div>
      </section>

      <main className="page-enter page-enter-delay-1 mx-auto max-w-[1200px] px-5 py-12 pb-28 lg:px-6">
        <HacksTimeline />
      </main>
    </div>
  );
}
