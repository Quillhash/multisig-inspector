import type { DecodedAction, XRayResult } from "./types";

const LIMITATION = "This tool decodes and analyzes transaction data locally. It cannot prove what another UI showed to a signer and cannot verify signer device security. Always verify recipient, amount, and intent through an independent channel.";

export function createXRayJson(result: XRayResult) { return JSON.stringify({ ...result, limitationNote: LIMITATION }, null, 2); }

export function createXRayMarkdown(result: XRayResult) {
  const verified = result.hashCheck.status === "match";
  return [
    "# Transaction Inspector Report", "", `Risk Level: ${result.riskLevel.toUpperCase()}`, "",
    "## Transaction Integrity", `Status: ${verified ? "MATCH" : "UNVERIFIED"}`,
    integrityExplanation(result.hashCheck.status),
    "> A matching hash confirms the transaction details were not altered between the Safe app and this tool. It does NOT prove the transaction is safe to sign.",
    ...(result.hashCheck.recomputedSafeTxHash ? [`Transaction hash (locally recomputed EIP-712): ${result.hashCheck.recomputedSafeTxHash}`] : []), "",
    ...(result.signerContext ? [
      "## Signer Context",
      `- Confirmations: ${result.signerContext.confirmations} of ${result.signerContext.confirmationsRequired} required`,
      ...(result.signerContext.isFinalSigner ? ["- WARNING: You would be the final signer — your signature executes this transaction."] : []),
      ...(result.signerContext.readyToExecute ? ["- WARNING: This transaction already has enough signatures to execute."] : []),
      "",
    ] : []),
    ...(result.simulation ? [
      "## Balance Simulation",
      `- Provider: ${result.simulation.provider}`,
      `- Status: ${result.simulation.status}`,
      ...(result.simulation.revertReason ? [`- Revert reason: ${result.simulation.revertReason}`] : []),
      ...(result.simulation.note ? [`- Note: ${result.simulation.note}`] : []),
      ...result.simulation.balanceDeltas.map((delta) => `- ${delta.asset}: ${delta.deltaFormatted}`),
      "",
    ] : []),
    "## In Simple Terms", ...result.summaryBullets.map((item) => `- ${item}`), "",
    "## Findings", ...(result.findings.length ? result.findings.flatMap((finding) => [`### ${finding.severity.toUpperCase()}: ${finding.title}`, finding.plainEnglish, `Recommendation: ${finding.recommendation}`, ""]) : ["No findings.", ""]),
    "## What Changes?", ...result.changes.balances.map((balance) => `- ${balance.asset} balance: ${balance.beforeFormatted} -> ${balance.afterFormatted}`),
    `- Owners added: ${result.changes.owners.added.join(", ") || "None"}`,
    `- Owners removed: ${result.changes.owners.removed.join(", ") || "None"}`,
    `- Threshold: ${result.changes.threshold ? `${result.changes.threshold.before ?? "Unknown"} -> ${result.changes.threshold.after}` : "No changes"}`,
    `- Modules added: ${result.changes.modules.added.join(", ") || "None"}`,
    `- Modules removed: ${result.changes.modules.removed.join(", ") || "None"}`,
    `- Guard: ${result.changes.guard ? `${result.changes.guard.before ?? "None"} -> ${result.changes.guard.after ?? "None"}` : "No changes"}`,
    `- Fallback handler: ${result.changes.fallbackHandler ? `${result.changes.fallbackHandler.before ?? "None"} -> ${result.changes.fallbackHandler.after ?? "None"}` : "No changes"}`, "",
    "## Decoded Actions", ...flattenActions(result.actions),
    "## Raw Transaction", `- Safe: ${result.input.safeAddress}`, `- Chain ID: ${result.input.chainId}`, `- Source: ${result.input.source}`, `- To: ${result.input.to}`, `- Value: ${result.input.value}`, `- Data: ${result.input.data}`, `- Operation: ${result.input.operation}`, `- Nonce: ${result.input.nonce}`, `- Safe TX gas: ${result.input.safeTxGas}`, `- Base gas: ${result.input.baseGas}`, `- Gas price: ${result.input.gasPrice}`, `- Gas token: ${result.input.gasToken}`, `- Refund receiver: ${result.input.refundReceiver}`, "",
    "## Recommendation", result.recommendation, "", "## Limitation", ...result.limitations.map((item) => `- ${item}`), LIMITATION,
  ].join("\n");
}

function flattenActions(actions: DecodedAction[]): string[] {
  return actions.flatMap((action) => [
    `### ${action.title}`,
    ...(action.reputation && action.reputation.status !== "unknown" ? [`Reputation: ${action.reputation.status}${action.reputation.label ? ` (${action.reputation.label})` : ""}`] : []),
    ...(action.tokenName && action.tokenExplorerUrl ? [`Token: [${action.tokenName}](${action.tokenExplorerUrl})`] : []),
    action.plainEnglish,
    `Technical details: ${action.technicalDetails}`,
    ...(action.selector ? [`Selector: ${action.selector}`] : []),
    "",
    ...flattenActions(action.children ?? []),
  ]);
}

function integrityExplanation(status: XRayResult["hashCheck"]["status"]) {
  if (status === "match") return "Locally recomputed hash matches the provided Safe transaction hash. The importer did not mangle the payload.";
  if (status === "mismatch") return "Locally recomputed hash does NOT match the provided Safe transaction hash. Do not sign until reviewed.";
  if (status === "unsupported") return "Local hash verification is unsupported for this Safe version (requires v1.3.0+).";
  return "No provided Safe transaction hash is available for local comparison (common for manual input).";
}
