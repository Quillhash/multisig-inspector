"use client";

import { Download, FileJson, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHead } from "@/components/ui/card";
import { inputClassName } from "@/components/ui/input";
import { EmptyReportPanel } from "@/components/safe-inspector/empty-report-panel";
import { NetworkSelect } from "@/components/safe-inspector/network-select";
import { SiteHeader } from "@/components/safe-inspector/site-header";
import { getSupportedChain } from "@/lib/chains/chains";
import { createRpcClient } from "@/lib/chains/rpc";
import { createJsonReport } from "@/lib/reports/json";
import { createMarkdownReport } from "@/lib/reports/markdown";
import {
  createOwnerReviewSummary,
  evaluateOwnerReviewRisk,
  ownerReviewLabels,
  type OwnerReviewAnswer,
  type OwnerReviewSummary,
} from "@/lib/audit-context/owner-review";
import {
  calculateSecurityScore,
  evaluateChangeRisk,
  evaluateSafeRisk,
  selectPrimaryFindings,
} from "@/lib/risk/engine";
import { parseSafeAddressInput } from "@/lib/safe/address";
import { detectSafeChainsForAddress } from "@/lib/safe/detectChain";
import { formatScanError } from "@/lib/safe/errors";
import { scanSafe } from "@/lib/safe/scanner";
import type {
  ClassifiedAddress,
  RiskFinding,
  SafeSnapshot,
  SnapshotChange,
} from "@/lib/safe/types";
import { compareSnapshots } from "@/lib/snapshots/compare";
import { getLatestSnapshot, saveSnapshot } from "@/lib/snapshots/db";
import { cn } from "@/lib/utils/cn";

type ScanResult = {
  snapshot: SafeSnapshot;
  changes: SnapshotChange[];
};

type FinalReport = ScanResult & {
  findings: RiskFinding[];
  score: number;
  ownerReview: OwnerReviewSummary;
};

const SCORE_RING_RADIUS = 44;
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS;

export function SafeInspectorApp() {
  const [safeAddress, setSafeAddress] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [ownerReviewAnswer, setOwnerReviewAnswer] =
    useState<OwnerReviewAnswer | null>(null);
  const [activeSection, setActiveSection] = useState("findings");

  const scanMutation = useMutation({
    mutationFn: async (): Promise<ScanResult> => {
      // Accepts a raw 0x address, an eth:0x… prefixed address, or a Safe/explorer URL.
      const parsed = parseSafeAddressInput(safeAddress);
      let resolvedChainId = parsed.chainId ?? chainId ?? undefined;
      if (!resolvedChainId) {
        const detected = await detectSafeChainsForAddress(parsed.address);
        if (detected.length === 0) {
          throw new Error(
            "Could not detect a supported network for this Safe. Choose a network above and try again.",
          );
        }
        resolvedChainId = detected[0];
      }

      const client = createRpcClient(resolvedChainId);
      const previousSnapshot = await getLatestSnapshot(parsed.address, resolvedChainId);
      const snapshot = await scanSafe({
        client,
        safeAddress: parsed.address,
        chainId: resolvedChainId,
      });
      const changes = compareSnapshots(previousSnapshot, snapshot);

      await saveSnapshot(snapshot);

      return {
        snapshot,
        changes,
      };
    },
    onMutate: () => {
      setOwnerReviewAnswer(null);
      setShowAllFindings(false);
      setActiveSection("findings");
    },
    onSuccess: (data) => {
      // Reflect the resolved network in the selector after auto-detection.
      setChainId(data.snapshot.chainId);
    },
  });

  const selectedChain = useMemo(
    () => (chainId !== null ? getSupportedChain(chainId) : undefined),
    [chainId],
  );
  const result = scanMutation.data;
  const scanError = scanMutation.error
    ? formatScanError(scanMutation.error, selectedChain?.name)
    : null;
  const ownerReview = useMemo(
    () =>
      result && ownerReviewAnswer
        ? createOwnerReviewSummary({
            answer: ownerReviewAnswer,
            owners: result.snapshot.owners ?? [],
          })
        : null,
    [ownerReviewAnswer, result],
  );
  const finalReport: FinalReport | null = useMemo(() => {
    if (!result || !ownerReview) {
      return null;
    }

    const findings = [
      ...evaluateOwnerReviewRisk({
        answer: ownerReview.answer,
        owners: result.snapshot.owners ?? [],
      }),
      ...evaluateChangeRisk(result.changes),
      ...evaluateSafeRisk(result.snapshot),
    ];

    return {
      ...result,
      ownerReview,
      findings,
      score: calculateSecurityScore(findings),
    };
  }, [ownerReview, result]);
  const primaryFindings = finalReport
    ? selectPrimaryFindings(finalReport.findings, 2)
    : [];
  const hiddenFindings = finalReport
    ? finalReport.findings.filter((finding) => !primaryFindings.includes(finding))
    : [];

  // Scroll-spy: highlight the section nav link for whatever is currently in view.
  useEffect(() => {
    if (!finalReport) {
      return;
    }
    const elements = ["findings", "owners", "config", "changes"]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [finalReport]);

  const heroOwners = finalReport
    ? String(finalReport.snapshot.owners?.length ?? 0)
    : result
      ? String(result.snapshot.owners?.length ?? 0)
      : "-";
  const heroThreshold = finalReport
    ? String(finalReport.snapshot.threshold)
    : result
      ? String(result.snapshot.threshold)
      : "-";
  const heroFindings = finalReport ? String(finalReport.findings.length) : "-";

  return (
    <div className="min-h-screen text-foreground">
      <SiteHeader />

      <section className="page-enter border-b border-white/60">
        <div className="mx-auto grid max-w-[1320px] items-end gap-8 px-5 py-8 lg:grid-cols-[1fr_auto] lg:px-6">
          <div>
            <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-accent uppercase">
              QuillAudits · Multisig inspector
            </p>
            <h1 className="mt-3 max-w-[20ch] text-[clamp(1.75rem,3.2vw,2.35rem)] leading-[1.08] font-bold tracking-tight text-pretty">
              Read-only{" "}
              <span className="text-accent">security report</span>
            </h1>
            <p className="mt-3 max-w-[48ch] text-[0.92rem] leading-relaxed text-muted text-pretty">
              Inspect Gnosis Safe configuration on-chain. Surface ownership risk,
              module exposure, and configuration drift. Export the report as
              audit evidence without a backend.
            </p>
          </div>
          {(finalReport || result) && (
            <div className="page-enter-delay-1 grid min-w-[280px] grid-cols-3 border border-rule">
              <HeroStat label="Owners" value={heroOwners} />
              <HeroStat label="Threshold" value={heroThreshold} />
              <HeroStat label="Findings" value={heroFindings} />
            </div>
          )}
        </div>
      </section>

      <div className="page-enter-delay-2 mx-auto grid max-w-[1320px] gap-5 px-5 py-5 pb-10 lg:grid-cols-[360px_1fr] lg:px-6">
        <aside className="space-y-3 lg:sticky lg:top-[4.25rem] lg:self-start">
          <Card>
            <CardHead>Scan Safe</CardHead>
            <div className="p-4 pt-0">
              <form
                className="space-y-3.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  scanMutation.mutate();
                }}
              >
                <label className="block">
                  <span className="text-[0.8rem] font-semibold text-muted">
                    Network{" "}
                    <span className="font-normal text-muted-faint">
                      (optional — auto-detected)
                    </span>
                  </span>
                  <NetworkSelect value={chainId} onChange={setChainId} />
                </label>

                <label className="block">
                  <span className="text-[0.8rem] font-semibold text-muted">
                    Safe address or URL
                  </span>
                  <input
                    className={cn(inputClassName, "font-mono text-[0.8rem]")}
                    placeholder="0x… · eth:0x… · Safe / explorer URL"
                    value={safeAddress}
                    onChange={(event) => setSafeAddress(event.target.value)}
                  />
                </label>

                <Button
                  className="mt-1 w-full disabled:opacity-100"
                  disabled={scanMutation.isPending || !safeAddress.trim()}
                  type="submit"
                >
                  {scanMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {scanMutation.isPending ? "Scanning" : "Scan"}
                </Button>
              </form>

              {scanError ? (
                <div className="mt-4 rounded-md border border-critical-border bg-critical-soft p-3 text-sm text-critical">
                  <div className="font-semibold">{scanError.title}</div>
                  <p className="mt-1 leading-relaxed">{scanError.message}</p>
                  {scanError.help ? (
                    <p className="mt-2 text-[0.8rem] leading-relaxed text-critical/80">
                      {scanError.help}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHead>Read-only by design</CardHead>
            <div className="p-4 pt-0">
              <ul className="space-y-1.5 text-[0.8rem] leading-relaxed text-muted">
                {[
                  "No wallet connection",
                  "No Safe SDK or API",
                  "No transaction creation",
                  "No backend database",
                  "Local IndexedDB snapshots only",
                ].map((item) => (
                  <li key={item} className="relative pl-3.5">
                    <span className="absolute top-[0.65em] left-0 h-1 w-1 rounded-full bg-rule-strong" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Card>


        </aside>

        <main className="min-h-[560px]">
          {result && !finalReport ? (
            <OwnerVerificationCard
              owners={result.snapshot.owners}
              blockNumber={result.snapshot.blockNumber.toString()}
              onAnswer={setOwnerReviewAnswer}
            />
          ) : finalReport ? (
            <>
              <section className="mb-3 grid gap-3 md:grid-cols-[200px_1fr]">
                <Card className="flex flex-col items-center justify-center gap-2 p-5 text-center">
                  <div className="text-[0.733rem] font-semibold tracking-[0.06em] text-muted-faint uppercase">
                    Security score
                  </div>
                  <ScoreRing score={finalReport.score} />
                  <div
                    className={cn(
                      "inline-block rounded px-2.5 py-1.5 text-[0.733rem] font-semibold",
                      scoreLabelClass(finalReport.score),
                    )}
                  >
                    {scoreLabel(finalReport.score)}
                  </div>
                  <p className="text-[0.75rem] leading-relaxed text-muted-faint">
                    Based on current configuration rules
                  </p>
                </Card>

                <Card className="p-5">
                  <div className="text-[0.733rem] font-semibold tracking-[0.06em] text-muted-faint uppercase">
                    Scanned Safe
                  </div>
                  <div className="mt-2 break-all font-mono text-[0.8rem] leading-relaxed">
                    {finalReport.snapshot.safeAddress}
                  </div>
                  <div className="mt-2.5 text-[0.8rem] text-muted">
                    <strong className="font-semibold text-foreground">
                      {selectedChain?.name}
                    </strong>{" "}
                    · block {finalReport.snapshot.blockNumber.toString()}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        downloadText(
                          "multisig-inspector-report.md",
                          createMarkdownReport(finalReport),
                          "text/markdown",
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      Export Markdown
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        downloadText(
                          "multisig-inspector-report.json",
                          createJsonReport(finalReport),
                          "application/json",
                        )
                      }
                    >
                      <FileJson className="h-4 w-4" />
                      Export JSON
                    </Button>
                  </div>
                </Card>
              </section>

              <div className="grid items-start gap-3 lg:grid-cols-[180px_1fr]">
                <nav
                  className="glass-panel hidden flex-col gap-0.5 rounded-[12px] border p-2 lg:sticky lg:top-[4.25rem] lg:flex"
                  aria-label="Report sections"
                >
                  <SectionNavLink
                    active={activeSection === "findings"}
                    count={finalReport.findings.length}
                    href="#findings"
                    label="Findings"
                    onSelect={() => setActiveSection("findings")}
                  />
                  <SectionNavLink
                    active={activeSection === "owners"}
                    href="#owners"
                    label="Owner review"
                    onSelect={() => setActiveSection("owners")}
                  />
                  <SectionNavLink
                    active={activeSection === "config"}
                    href="#config"
                    label="Configuration"
                    onSelect={() => setActiveSection("config")}
                  />
                  <SectionNavLink
                    active={activeSection === "changes"}
                    count={finalReport.changes.length}
                    href="#changes"
                    label="Changes"
                    onSelect={() => setActiveSection("changes")}
                  />
                </nav>

                <div className="space-y-3">
                  <ReportSection id="findings" title="Findings">
                    {primaryFindings.length ? (
                      <div className="space-y-2.5">
                        {primaryFindings.map((finding, index) => (
                          <FindingCard
                            key={`${finding.id}-${index}`}
                            finding={finding}
                          />
                        ))}
                        {hiddenFindings.length ? (
                          <div className="rounded-md border border-rule bg-accent-soft p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="text-[0.867rem] font-semibold">
                                  {hiddenFindings.length} more technical
                                  findings
                                </div>
                                <p className="mt-1 text-[0.8rem] text-muted">
                                  Lower-priority issues and scanner limitations
                                  are hidden from the main report by default.
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setShowAllFindings((value) => !value)
                                }
                              >
                                {showAllFindings
                                  ? "Hide technical findings"
                                  : "Show all findings"}
                              </Button>
                            </div>
                            {showAllFindings ? (
                              <div className="mt-4 space-y-2.5">
                                {hiddenFindings.map((finding, index) => (
                                  <FindingCard
                                    key={`${finding.id}-hidden-${index}`}
                                    finding={finding}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <EmptyState text="No findings detected by the current rule set." />
                    )}
                  </ReportSection>

                  <ReportSection id="owners" title="Owner review">
                    <div className="rounded-md border border-rule bg-accent-soft p-4">
                      <div className="text-[0.867rem] font-semibold">
                        {ownerReviewLabels[finalReport.ownerReview.answer]}
                      </div>
                      <div className="mt-3 space-y-2">
                        {finalReport.ownerReview.owners.map((owner, index) => (
                          <OwnerRow
                            key={owner}
                            address={owner}
                            index={index + 1}
                          />
                        ))}
                      </div>
                    </div>
                  </ReportSection>

                  <ReportSection id="config" title="Safe configuration">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ConfigItem
                        label="Owners"
                        value={finalReport.snapshot.owners?.length ?? 0}
                      />
                      <ConfigItem
                        label="Threshold"
                        value={`${finalReport.snapshot.threshold ?? 0} of ${finalReport.snapshot.owners?.length ?? 0}`}
                      />
                      <ConfigItem
                        label="Nonce"
                        value={(finalReport.snapshot.nonce ?? 0n).toString()}
                      />
                      <ConfigItem
                        label="Version"
                        value={finalReport.snapshot.version ?? "Unknown"}
                      />
                      <ConfigItem
                        label="Singleton"
                        value={finalReport.snapshot.singleton ?? "Unknown"}
                        helper={
                          formatClassification(
                            finalReport.snapshot.classifications?.singleton,
                          )
                        }
                        mono
                      />
                      <ConfigItem
                        label="Fallback handler"
                        value={finalReport.snapshot.fallbackHandler ?? "None"}
                        helper={
                          formatClassification(
                            finalReport.snapshot.classifications
                              ?.fallbackHandler,
                          )
                        }
                        mono
                      />
                      <ConfigItem
                        label="Guard"
                        value={finalReport.snapshot.guard ?? "None"}
                        helper={formatClassification(
                          finalReport.snapshot.classifications?.guard,
                        )}
                        mono
                      />
                      <ConfigItem
                        label="Modules"
                        value={finalReport.snapshot.modules?.length ?? 0}
                      />
                    </div>
                  </ReportSection>

                  <ReportSection id="changes" title="Changes since last scan">
                    {finalReport.changes.length ? (
                      <div className="space-y-2">
                        {finalReport.changes.map((change, index) => (
                          <div
                            key={`${change.type}-${index}`}
                            className="rounded-md border border-rule p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold">{change.title}</div>
                              <SeverityBadge severity={change.severity} />
                            </div>
                            <div className="mt-2 break-all font-mono text-[0.733rem] text-muted">
                              {formatChangeValue(change.before)}{" "}
                              <span className="font-bold text-critical">→</span>{" "}
                              {formatChangeValue(change.after)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="No previous-scan changes detected for this Safe and network." />
                    )}
                  </ReportSection>
                </div>
              </div>
            </>
          ) : (
            <EmptyReportPanel
              scanning={scanMutation.isPending}
              scanAddress={safeAddress}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-rule bg-accent-soft px-4 py-3.5 text-center last:border-r-0">
      <div className="text-[0.667rem] font-semibold tracking-[0.06em] text-muted-faint uppercase">
        {label}
      </div>
      <div className="mt-1 text-[0.933rem] font-bold">{value}</div>
    </div>
  );
}

function SectionNavLink({
  label,
  href,
  active,
  count,
  onSelect,
}: {
  label: string;
  href: string;
  active: boolean;
  count?: number;
  onSelect: () => void;
}) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onSelect();
        document.querySelector(href)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }}
      className={cn(
        "block rounded-md border-l-2 px-2.5 py-2 text-[0.8rem] font-medium text-muted transition",
        active
          ? "border-accent bg-accent-soft font-semibold text-accent"
          : "border-transparent hover:bg-accent-soft hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span className="float-right font-mono text-[0.667rem] opacity-70">
          {count}
        </span>
      ) : null}
    </a>
  );
}

function ScoreRing({ score }: { score: number }) {
  const offset =
    SCORE_RING_CIRCUMFERENCE - (score / 100) * SCORE_RING_CIRCUMFERENCE;
  const strokeColor =
    score >= 80 ? "#103DD3" : score >= 50 ? "#FF7428" : "#960028";

  return (
    <div className="relative mx-auto h-[104px] w-[104px]">
      <svg
        className="h-full w-full -rotate-90"
        viewBox="0 0 104 104"
        aria-hidden
      >
        <circle
          cx="52"
          cy="52"
          r={SCORE_RING_RADIUS}
          fill="none"
          stroke="#e3e3df"
          strokeWidth="8"
        />
        <circle
          cx="52"
          cy="52"
          r={SCORE_RING_RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={SCORE_RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.6rem] leading-none font-bold tracking-tight">
          {score}
        </span>
        <span className="mt-0.5 text-[0.65rem] text-muted-faint">/ 100</span>
      </div>
    </div>
  );
}

function OwnerVerificationCard({
  owners,
  blockNumber,
  onAnswer,
}: {
  owners: SafeSnapshot["owners"];
  blockNumber: string;
  onAnswer: (answer: OwnerReviewAnswer) => void;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-[1.067rem] font-bold tracking-tight">
        Owner verification
      </h2>
      <p className="mt-2 max-w-[58ch] text-[0.867rem] leading-relaxed text-muted">
        These addresses can approve transactions from this Safe. Do you recognize
        them as expected signers? Your answer is stored only locally and
        included in exports.
      </p>
      <div className="mt-5 space-y-2">
        {(owners ?? []).map((owner, index) => (
          <OwnerRow key={owner} address={owner} index={index + 1} />
        ))}
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <Button type="button" onClick={() => onAnswer("all_expected")}>
          All owners expected
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => onAnswer("unexpected_owner")}
        >
          Some look unexpected
        </Button>
        <Button type="button" variant="secondary" onClick={() => onAnswer("not_sure")}>
          I am not sure
        </Button>
      </div>
      <div className="mt-4 rounded-md bg-accent-soft p-3.5 text-[0.8rem] leading-relaxed text-accent">
        RPC scan complete at block {blockNumber}. Confirm owners to generate the
        full security report.
      </div>
    </Card>
  );
}

function OwnerRow({ address, index }: { address: string; index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-rule bg-accent-soft px-3 py-2.5">
      <span className="w-5 shrink-0 font-mono text-[0.667rem] font-medium text-muted-faint">
        {String(index).padStart(2, "0")}
      </span>
      <span className="break-all font-mono text-[0.733rem]">{address}</span>
    </div>
  );
}

function ReportSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-[5rem] p-5">
      <h2 className="mb-4 border-b border-rule pb-3 text-[0.8rem] font-bold tracking-[0.06em] text-foreground uppercase">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function FindingCard({ finding }: { finding: RiskFinding }) {
  return (
    <div className="rounded-md border border-rule p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold tracking-tight">{finding.title}</h3>
          <div className="mt-1 text-[0.75rem] text-muted-faint">
            {finding.category} · {finding.confidence} confidence
          </div>
        </div>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="mt-2.5 text-[0.867rem] leading-relaxed text-muted">
        {finding.userExplanation}
      </p>
      <p className="mt-2.5 text-[0.867rem] font-semibold">
        {finding.recommendation}
      </p>
      {finding.relatedIncident ? (
        <div className="mt-3 rounded-md border border-rule bg-accent-soft p-3.5 text-[0.8rem]">
          <div className="font-semibold">
            Similar risk pattern: {finding.relatedIncident.name}
          </div>
          <p className="mt-1 leading-relaxed text-muted">
            {finding.relatedIncident.pattern}
          </p>
        </div>
      ) : null}
      <details className="mt-3">
        <summary className="cursor-pointer text-[0.867rem] font-semibold text-muted">
          Technical explanation
        </summary>
        <p className="mt-2 text-[0.867rem] leading-relaxed text-muted">
          {finding.technicalExplanation}
        </p>
      </details>
      {finding.evidence ? (
        <pre className="mt-3 overflow-x-auto rounded-md bg-accent-soft p-3 font-mono text-[0.733rem] leading-relaxed text-muted">
          {formatEvidence(finding.evidence)}
        </pre>
      ) : null}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: RiskFinding["severity"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-2 py-1 text-[0.667rem] font-bold tracking-[0.05em] uppercase",
        severity === "critical" && "bg-[#fce8ee] text-critical",
        severity === "high" && "bg-[#fde8e8] text-high",
        severity === "medium" && "bg-[#fff0e6] text-medium",
        severity === "low" && "bg-[#fff6e8] text-low",
        severity === "info" && "bg-[#f3e8ff] text-info",
      )}
    >
      {severity}
    </span>
  );
}

function ConfigItem({
  label,
  value,
  helper,
  mono = false,
}: {
  label: string;
  value: string | number;
  helper?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-rule bg-accent-soft p-3.5">
      <div className="text-[0.667rem] font-semibold tracking-[0.05em] text-muted-faint uppercase">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-[0.933rem] font-semibold break-all",
          mono && "font-mono text-[0.733rem] font-medium",
        )}
      >
        {value}
      </div>
      {helper ? (
        <div className="mt-1.5 text-[0.733rem] font-medium text-muted">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function formatClassification(
  classification?: ClassifiedAddress,
): string | undefined {
  if (!classification) {
    return undefined;
  }

  return [
    classification.label,
    `Status: ${classification.status}`,
    classification.source ? `Source: ${classification.source}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-rule bg-accent-soft p-4 text-[0.867rem] text-muted">
      {text}
    </div>
  );
}

function scoreLabel(score: number): string {
  if (score >= 80) {
    return "Low risk";
  }

  if (score >= 50) {
    return "Review recommended";
  }

  return "Immediate review required";
}

function scoreLabelClass(score: number): string {
  if (score >= 80) {
    return "bg-accent-soft text-accent";
  }

  if (score >= 50) {
    return "bg-[#fff0e6] text-medium";
  }

  return "bg-[#fce8ee] text-critical";
}

function downloadText(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatChangeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function formatEvidence(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
