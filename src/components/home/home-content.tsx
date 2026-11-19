import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { HACKS, formatUsdCompact, totalLossUsd, verdictCounts } from "@/components/hacks/hacks-data";
import { HOME_FAQ } from "@/lib/seo/faq";
import { MAINNET_NAMES, TESTNET_NAMES } from "@/lib/seo/networks";
import { PUBLISHER_URL } from "@/lib/seo/site";

const checks = [
  {
    title: "Owners and threshold",
    body: "Flags a threshold of 1, a small minority that can approve alone, very small owner sets and thresholds that exceed the owner count.",
  },
  {
    title: "Modules",
    body: "Lists every enabled module and marks the ones it does not recognize. A module can move funds without owner signatures.",
  },
  {
    title: "Transaction guard",
    body: "Reads the guard storage slot and reports whether a guard is set, and whether it is a known contract.",
  },
  {
    title: "Singleton and version",
    body: "Checks the implementation the proxy points at against known Safe deployments, so a swapped mastercopy stands out.",
  },
  {
    title: "Fallback handler",
    body: "Identifies the fallback handler and warns when it is unknown or has no contract code behind it.",
  },
  {
    title: "Configuration drift",
    body: "Compares each scan with your last local snapshot and highlights added owners, lowered thresholds, new modules and changed implementations.",
  },
] as const;

const steps = [
  {
    title: "Paste a Safe address or URL.",
    body: "A raw 0x address, an eth:0x… prefixed address, or a link from the Safe app or a block explorer. The network is detected for you on mainnets.",
  },
  {
    title: "Confirm the owners.",
    body: "The scan reads the Safe over direct RPC and lists every signer. You confirm whether each address is one you expect.",
  },
  {
    title: "Read and export the report.",
    body: "You get a security score, prioritized findings with recommendations, and a Markdown or JSON export to keep as audit evidence.",
  },
] as const;

export function HomeContent() {
  const counts = verdictCounts();
  const helped = counts.yes + counts.partially;

  return (
    <>
      <section aria-labelledby="checks-heading" className="qa-container qa-section">
        <p className="qa-eyebrow qa-center-mobile">Safe Inspector</p>
        <h2 id="checks-heading" className="qa-h2 qa-center-mobile mt-4 max-w-[22ch] max-lg:mx-auto">
          What the Safe multisig scan checks.
        </h2>
        <p className="qa-body-lg qa-center-mobile mt-6 max-w-[62ch] max-lg:mx-auto">
          Multisig Inspector reads every value from the Safe contract on the
          selected network, not from an indexer or a hosted backend.
        </p>
        <ul className="qa-grid qa-grid--3 mt-12 list-none p-0">
          {checks.map(({ title, body }) => (
            <li key={title} className="qa-card">
              <h3 className="qa-h3">{title}</h3>
              <p className="mt-3">{body}</p>
            </li>
          ))}
        </ul>
        <p className="qa-small mt-6 qa-center-mobile">
          Supported networks: {MAINNET_NAMES.join(", ")}, plus {TESTNET_NAMES.join(" and ")} testnets.
        </p>
      </section>

      <section aria-labelledby="how-heading" className="qa-container qa-section pt-0!">
        <h2 id="how-heading" className="qa-h2 text-center">
          How to check a Safe multisig in three steps.
        </h2>
        <ol className="qa-grid qa-grid--3 mt-12 list-none p-0">
          {steps.map((step, index) => (
            <li key={step.title} className="qa-card">
              <p className="qa-step-label">Step {String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 text-lg leading-7 font-semibold text-foreground">{step.title}</h3>
              <p className="mt-3">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="hacks-heading" className="qa-section qa-section--dark">
        <div className="qa-container">
          <p className="qa-eyebrow qa-center-mobile">Why it matters</p>
          <h2 id="hacks-heading" className="qa-h2 qa-center-mobile mt-4 max-w-[24ch] max-lg:mx-auto">
            {formatUsdCompact(totalLossUsd())} lost across {HACKS.length} multisig incidents. The contracts held.
          </h2>
          <p className="qa-body-lg qa-center-mobile mt-6 max-w-[62ch] max-lg:mx-auto">
            Most multisig losses happen after the audit, in the gap between a
            transaction being created and a signer approving it. In {helped} of
            the {HACKS.length} incidents we tracked, an independent
            configuration scan or transaction review could have helped fully or
            partially.
          </p>
          <dl className="qa-grid qa-grid--3 mt-12">
            <VerdictStat value={counts.yes} label="Could have helped" />
            <VerdictStat value={counts.partially} label="Could have helped partially" />
            <VerdictStat value={counts.no} label="Out of scope for this tool" />
          </dl>
          <div className="mt-10 flex max-lg:justify-center">
            <Link href="/hacks" className="qa-pill">
              <span className="qa-pill__icon bg-white! text-foreground!">
                <ArrowUpRight aria-hidden="true" />
              </span>
              See the multisig hack timeline
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="tools-heading" className="qa-container qa-section">
        <h2 id="tools-heading" className="qa-h2 qa-h2--lg mx-auto max-w-[20ch] text-center">
          Two tools. Two human checks.
        </h2>
        <p className="qa-body-lg mx-auto mt-6 max-w-[58ch] text-center">
          Review the Safe, then review the transaction. Each tool gives you an
          independent reading. The final comparison is always yours.
        </p>
        <div className="qa-grid qa-grid--2 mt-12">
          <ToolCard
            label="Configuration"
            title="Safe Inspector"
            body="Is this Safe configured as intended, and has anything changed since the last time you looked?"
            points={[
              "Owners, threshold, modules, guard and singleton",
              "Severity ranked findings with fixes",
              "Local snapshots for drift detection",
            ]}
            href="/docs/safe-inspector"
            cta="How Safe Inspector works"
          />
          <ToolCard
            label="Before signing"
            highlight
            title="Transaction Inspector"
            body="What will this transaction do, and is the hash on your signing device the one you reviewed?"
            points={[
              "Decodes calldata and MultiSend batches",
              "Recomputes the Safe transaction hash locally",
              "Optional current-state simulation",
            ]}
            href="/transaction-xray"
            cta="Inspect a transaction"
          />
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="qa-container qa-section pt-0!">
        <h2 id="faq-heading" className="qa-h2 text-center">
          Frequently asked questions
        </h2>
        <div className="qa-narrow mt-12">
          {HOME_FAQ.map((entry) => (
            <details key={entry.question} className="qa-faq__item">
              <summary>
                <h3 className="m-0 text-lg leading-7 font-semibold">{entry.question}</h3>
              </summary>
              <p>{entry.answer}</p>
            </details>
          ))}
          <p className="qa-prose mt-8 text-center">
            More detail in the <Link href="/docs">documentation</Link> and the{" "}
            <Link href="/docs/security-model">security and trust model</Link>.
          </p>
        </div>
      </section>

      <section aria-labelledby="audit-heading" className="qa-panel qa-cta-panel qa-cta-panel--map">
        <h2 id="audit-heading" className="qa-statement mx-auto max-w-[760px] uppercase">
          The scanner shows the state. The audit tests the system.
        </h2>
        <p className="qa-lead mx-auto mt-6 mb-12 max-w-[900px]">
          Multisig Inspector reviews Safe configuration and individual
          transactions. It does not replace an audit of your signers, keys and
          signing process. QuillAudits does that work.
        </p>
        <a href={`${PUBLISHER_URL}/opsec-and-multisig-audit`} className="qa-btn qa-btn--white">
          See the OPSEC and Multisig Audit
        </a>
      </section>
    </>
  );
}

function VerdictStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="qa-card qa-card--dark qa-card--stat flex flex-col-reverse text-center">
      <dt className="mt-2">{label}</dt>
      <dd className="qa-stat m-0 text-[#EEEEEE]">{value} of {HACKS.length}</dd>
    </div>
  );
}

function ToolCard({
  label,
  highlight = false,
  title,
  body,
  points,
  href,
  cta,
}: {
  label: string;
  highlight?: boolean;
  title: string;
  body: string;
  points: string[];
  href: string;
  cta: string;
}) {
  return (
    <article className="qa-card qa-card--feature">
      <span className={highlight ? "qa-card__label qa-card__label--highlight" : "qa-card__label"}>
        {label}
      </span>
      <h3 className="qa-h3 qa-h3--lg">{title}</h3>
      <p>{body}</p>
      <ul className="mb-4 grid list-none gap-4 p-0">
        {points.map((point) => (
          <li key={point} className="qa-check">
            {point}
          </li>
        ))}
      </ul>
      <Link href={href} className="qa-btn qa-btn--block">
        {cta}
      </Link>
    </article>
  );
}
