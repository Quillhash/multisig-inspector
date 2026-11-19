import { SiteHeader } from "@/components/safe-inspector/site-header";
import { HACKS, formatUsdCompact, totalLossUsd } from "./hacks-data";
import { HacksTimeline } from "./hacks-timeline";

export function HacksPage() {
  return (
    <div className="text-muted">
      <SiteHeader active="hacks" />

      <section className="qa-container qa-hero qa-hero--tight page-enter">
        <p className="qa-eyebrow qa-eyebrow--hero qa-center-mobile">Incident timeline</p>
        <h1 className="qa-h1 qa-h1--product qa-center-mobile mt-4 max-w-[22ch] max-lg:mx-auto">
          Multisig hacks and <span className="qa-accent">what would have stopped them.</span>
        </h1>
        <p className="qa-body-lg qa-center-mobile mt-6 max-w-[64ch] max-lg:mx-auto">
          {HACKS.length} real multisig incidents worth {formatUsdCompact(totalLossUsd())} in
          losses, with the attack vector for each and an honest verdict on
          whether independent decoding, hash verification or a Safe
          configuration scan could have prevented it.
        </p>
      </section>

      <main id="main" className="qa-container page-enter page-enter-delay-1 pt-16 pb-36">
        <HacksTimeline />
      </main>
    </div>
  );
}
