import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  Fingerprint,
  GitCompareArrows,
  KeyRound,
  Layers,
  Plus,
  Puzzle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { HACKS, formatUsdCompact, totalLossUsd, verdictCounts } from "@/components/hacks/hacks-data";
import { HOME_FAQ } from "@/lib/seo/faq";
import { MAINNET_NAMES, TESTNET_NAMES } from "@/lib/seo/networks";
import { PUBLISHER_URL } from "@/lib/seo/site";

const checks = [
  {
    icon: Users,
    title: "Owners and threshold",
    body: "Flags a threshold of 1, a small minority that can approve alone, very small owner sets and thresholds that exceed the owner count.",
  },
  {
    icon: Puzzle,
    title: "Modules",
    body: "Lists every enabled module and marks the ones it does not recognize. A module can move funds without owner signatures.",
  },
  {
    icon: ShieldCheck,
    title: "Transaction guard",
    body: "Reads the guard storage slot and reports whether a guard is set, and whether it is a known contract.",
  },
  {
    icon: Layers,
    title: "Singleton and version",
    body: "Checks the implementation the proxy points at against known Safe deployments, so a swapped mastercopy stands out.",
  },
  {
    icon: KeyRound,
    title: "Fallback handler",
    body: "Identifies the fallback handler and warns when it is unknown or has no contract code behind it.",
  },
  {
    icon: GitCompareArrows,
    title: "Configuration drift",
    body: "Compares each scan with your last local snapshot and highlights added owners, lowered thresholds, new modules and changed implementations.",
  },
] as const;

const steps = [
  {
    title: "Paste a Safe address or URL",
    body: "A raw 0x address, an eth:0x… prefixed address, or a link from the Safe app or a block explorer. The network is detected for you on mainnets.",
  },
  {
    title: "Confirm the owners",
    body: "The scan reads the Safe over direct RPC and lists every signer. You confirm whether each address is one you expect.",
  },
  {
    title: "Read and export the report",
    body: "You get a security score, prioritized findings with recommendations, and a Markdown or JSON export to keep as audit evidence.",
  },
] as const;

export function HomeContent() {
  const counts = verdictCounts();
  const helped = counts.yes + counts.partially;

  return (
    <div className="bg-background">
      <section aria-labelledby="checks-heading" className="mx-auto max-w-[1200px] px-5 py-16 sm:py-20 lg:px-6">
        <SectionIntro
          id="checks-heading"
          eyebrow="Safe Inspector"
          title="What the Safe multisig scan checks"
          lead="Every value is read from the Safe contract on the selected network, not from an indexer or a hosted backend."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-[14px] border border-rule bg-surface p-6 shadow-[var(--shadow-card)]">
              <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent-soft text-accent">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-[1.02rem] font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Supported networks: {MAINNET_NAMES.join(", ")}, plus {TESTNET_NAMES.join(" and ")} testnets.
        </p>
      </section>

      <section aria-labelledby="how-heading" className="border-y border-rule bg-surface">
        <div className="mx-auto max-w-[1200px] px-5 py-16 sm:py-20 lg:px-6">
          <SectionIntro
            id="how-heading"
            eyebrow="How it works"
            title="How to check a Safe multisig in three steps"
          />
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative border-t-2 border-foreground pt-5">
                <span className="font-mono text-xs font-medium text-muted-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-[1.08rem] font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="tools-heading" className="mx-auto max-w-[1200px] px-5 py-16 sm:py-20 lg:px-6">
        <SectionIntro
          id="tools-heading"
          eyebrow="Two tools, two human checks"
          title="Review the Safe, then review the transaction"
          lead="Contract audits cover the code. Most multisig losses happen later, in the gap between a transaction being created and a signer approving it."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <ToolCard
            icon={<FileSearch className="h-5 w-5" aria-hidden="true" />}
            title="Safe Inspector"
            body="Answers one question: is this Safe configured as intended, and has anything changed since the last time you looked?"
            points={["Owners, threshold, modules, guard, singleton", "Severity ranked findings with fixes", "Local snapshots for drift detection"]}
            href="/docs/safe-inspector"
            cta="How Safe Inspector works"
          />
          <ToolCard
            icon={<Fingerprint className="h-5 w-5" aria-hidden="true" />}
            title="Transaction Inspector"
            body="Answers the other one: what will this transaction do, and is the hash on your signing device the one you reviewed?"
            points={["Decodes calldata and MultiSend batches", "Recomputes the Safe transaction hash locally", "Optional current-state simulation"]}
            href="/transaction-xray"
            cta="Inspect a transaction"
          />
        </div>
      </section>

      <section aria-labelledby="hacks-heading" className="hero-ink">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:px-6">
          <div>
            <p className="eyebrow">Why it matters</p>
            <h2 id="hacks-heading" className="mt-3 text-[clamp(1.6rem,3.2vw,2.3rem)] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">
              {formatUsdCompact(totalLossUsd())} lost across {HACKS.length} multisig incidents we tracked
            </h2>
            <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-white/70">
              In {helped} of those {HACKS.length} incidents, an independent
              configuration scan or transaction review could have helped fully
              or partially. The timeline explains each one, including the cases
              where this tool would not have made a difference.
            </p>
            <Link
              href="/hacks"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-[10px] bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-white/90"
            >
              See the multisig hack timeline
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04]">
            <Stat value={String(counts.yes)} label="Could have helped" />
            <Stat value={String(counts.partially)} label="Partially" />
            <Stat value={String(counts.no)} label="Out of scope" />
          </dl>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="mx-auto max-w-[860px] px-5 py-16 sm:py-20 lg:px-6">
        <SectionIntro id="faq-heading" eyebrow="FAQ" title="Safe multisig security questions, answered" />
        <div className="mt-8 divide-y divide-rule rounded-[14px] border border-rule bg-surface shadow-[var(--shadow-card)]">
          {HOME_FAQ.map((entry, index) => (
            <details key={entry.question} className="faq-item group px-5 sm:px-6" open={index === 0}>
              <summary className="flex items-center justify-between gap-4 py-5">
                <h3 className="text-[1rem] font-semibold tracking-tight">{entry.question}</h3>
                <Plus className="faq-chevron h-4 w-4 shrink-0 text-muted-faint transition-transform" aria-hidden="true" />
              </summary>
              <p className="pb-5 text-[0.95rem] leading-relaxed text-muted">{entry.answer}</p>
            </details>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted">
          More detail in the{" "}
          <Link href="/docs" className="font-semibold text-accent hover:underline">
            documentation
          </Link>{" "}
          and the{" "}
          <Link href="/docs/security-model" className="font-semibold text-accent hover:underline">
            security and trust model
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="audit-heading" className="mx-auto max-w-[1200px] px-5 pb-20 lg:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-[#d9e1ff] bg-accent-soft p-8 md:flex-row md:items-center sm:p-10">
          <div>
            <h2 id="audit-heading" className="text-[1.4rem] font-semibold tracking-tight">
              Need more than a configuration scan?
            </h2>
            <p className="mt-2 max-w-[60ch] text-[0.95rem] leading-relaxed text-muted">
              This tool reviews Safe configuration and individual transactions.
              It does not replace a full audit of your contracts, signer
              operations or key management. QuillAudits does that work.
            </p>
          </div>
          <a
            href={PUBLISHER_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Talk to QuillAudits
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
}

function SectionIntro({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-[720px]">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-[clamp(1.6rem,3.2vw,2.3rem)] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">
        {title}
      </h2>
      {lead ? <p className="mt-4 text-base leading-relaxed text-muted text-pretty">{lead}</p> : null}
    </div>
  );
}

function ToolCard({
  icon,
  title,
  body,
  points,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  points: string[];
  href: string;
  cta: string;
}) {
  return (
    <article className="flex flex-col rounded-[14px] border border-rule bg-surface p-7 shadow-[var(--shadow-card)]">
      <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-foreground text-white">{icon}</span>
      <h3 className="mt-4 text-[1.2rem] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{body}</p>
      <ul className="mt-4 space-y-2 text-sm text-foreground">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5">
            <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
        {cta}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse px-4 py-7 text-center">
      <dt className="mt-2 text-xs leading-snug text-white/60">{label}</dt>
      <dd className="text-[2.2rem] leading-none font-semibold tracking-tight">{value}</dd>
    </div>
  );
}
