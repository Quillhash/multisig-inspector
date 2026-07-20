import type { RiskFinding, SafeSnapshot, SnapshotChange } from "@/lib/safe/types";
import type { OwnerReviewSummary } from "@/lib/audit-context/owner-review";

export function createMarkdownReport(params: {
  snapshot: SafeSnapshot;
  findings: RiskFinding[];
  changes: SnapshotChange[];
  score: number;
  ownerReview?: OwnerReviewSummary;
}): string {
  const { snapshot, findings, changes, ownerReview, score } = params;

  return [
    "# Safe Security Report",
    "",
    `Security score: ${score}/100`,
    "",
    "## Safe",
    "",
    `- Address: ${snapshot.safeAddress}`,
    `- Chain ID: ${snapshot.chainId}`,
    `- Block: ${snapshot.blockNumber.toString()}`,
    `- Scan time: ${snapshot.timestamp}`,
    `- Version: ${snapshot.version ?? "Unknown"}`,
    "",
    "## Configuration",
    "",
    `- Owners: ${snapshot.owners ? snapshot.owners.length : "Unreadable"}`,
    `- Threshold: ${snapshot.threshold ?? "Unreadable"}`,
    `- Nonce: ${snapshot.nonce !== null ? snapshot.nonce.toString() : "Unreadable"}`,
    `- Modules: ${snapshot.modules ? snapshot.modules.length : "Unreadable"}`,
    `- Version: ${snapshot.version ?? "Unknown"}`,
    formatComponentLine("Guard", snapshot.guard, snapshot.classifications?.guard),
    formatComponentLine(
      "Fallback handler",
      snapshot.fallbackHandler,
      snapshot.classifications?.fallbackHandler,
    ),
    formatComponentLine(
      "Singleton",
      snapshot.singleton,
      snapshot.classifications?.singleton,
    ),
    "",
    "## Owner Review",
    "",
    ownerReview
      ? [
          `- Result: ${ownerReview.label}`,
          `- Owners reviewed: ${ownerReview.ownerCount}`,
          ...ownerReview.owners.map((owner) => `  - ${owner}`),
        ].join("\n")
      : "Owner review was not completed.",
    "",
    "## Findings",
    "",
    findings.length
      ? findings
          .map(
            (finding) =>
              [
                `### ${finding.severity.toUpperCase()}: ${finding.title}`,
                "",
                `Category: ${finding.category}`,
                `Confidence: ${finding.confidence}`,
                "",
                finding.userExplanation,
                "",
                `Technical detail: ${finding.technicalExplanation}`,
                "",
                `Recommendation: ${finding.recommendation}`,
                finding.relatedIncident
                  ? `Similar risk pattern: ${finding.relatedIncident.name} (${finding.relatedIncident.year}) - ${finding.relatedIncident.pattern}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
          )
          .join("\n\n")
      : "No findings detected by the local rule set.",
    "",
    "## Changes Since Previous Scan",
    "",
    changes.length
      ? changes
          .map(
            (change) =>
              `- ${change.severity.toUpperCase()}: ${change.title} (${formatValue(change.before)} -> ${formatValue(change.after)})`,
          )
          .join("\n")
      : "No previous-scan changes detected.",
    "",
  ].join("\n");
}

function formatComponentLine(
  label: string,
  value: string | null,
  classification?: NonNullable<SafeSnapshot["classifications"]>["singleton"],
): string {
  const details = [
    classification?.label,
    classification?.status ? `Status: ${capitalize(classification.status)}` : "",
    classification?.source ? `Source: ${classification.source}` : "",
  ].filter(Boolean);

  return `- ${label}: ${value ?? "None"}${details.length ? ` (${details.join("; ")})` : ""}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}
