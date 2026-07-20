"use client";

import { useState } from "react";
import { Check, Copy, Download, FileJson } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { createXRayJson, createXRayMarkdown } from "../../lib/tx-xray/export";
import type { AddressReputation, DecodedAction, XRayResult } from "../../lib/tx-xray/types";
import { cn } from "../../lib/utils/cn";

export function TransactionResult({ result, resolveEnabled = false }: { result: XRayResult; resolveEnabled?: boolean }) {
  const urgent = result.findings.filter((item) => item.severity === "critical" || item.severity === "high");
  const partialDecodeFindings = result.findings.filter((item) => item.title === "Partial batch decode");
  const priorityFindings = [...urgent, ...partialDecodeFindings.filter((item) => !urgent.includes(item))];
  const balanceSource = result.simulation?.status === "success"
    ? "Projected from GoPlus simulation deltas applied to balances fetched independently over RPC."
    : "Estimated from decoded transfers. Gas, refunds, fee-on-transfer behavior, and intervening state changes are not included.";
  return (
    <div className="space-y-3" aria-live="polite">
      <ResultCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Transaction Integrity</p>
            <h2 className="mt-1 text-xl font-bold">{integrityLabel(result.hashCheck.status)}</h2>
          </div>
          <span className="rounded border border-rule px-2.5 py-1 text-xs font-semibold uppercase">{result.input.source}</span>
        </div>
        <p className="mt-2 text-sm text-muted">{integrityExplanation(result.hashCheck.status)}</p>
        {result.hashCheck.recomputedSafeTxHash ? (
          <p className="mt-3 break-all font-mono text-sm text-foreground">
            <span className="text-muted-faint">Transaction hash (locally recomputed EIP-712): </span>
            {result.hashCheck.recomputedSafeTxHash}
          </p>
        ) : null}
        {result.hashCheck.status === "match" ? (
          <p className="mt-2 text-xs text-warning">
            ⚠ A matching hash confirms the transaction details were not altered between the Safe app and this tool. It does <strong>not</strong> prove this transaction is safe to sign.
          </p>
        ) : null}
      </ResultCard>

      <ResultCard>
        <p className="eyebrow">Risk Level</p>
        <h2 className={cn("mt-1 text-2xl font-bold capitalize", result.riskLevel === "critical" && "text-critical", result.riskLevel === "high" && "text-high")}>{result.riskLevel}</h2>
      </ResultCard>

      <TransactionDataCard input={result.input} />

      {result.signerContext ? <SignerContextCard context={result.signerContext} /> : null}
      {result.simulation ? <SimulationCard simulation={result.simulation} /> : null}

      {priorityFindings.length ? (
        <ResultCard className="border-critical/40">
          <h2 className="text-lg font-bold">Priority Findings</h2>
          <div className="mt-3 space-y-3">{priorityFindings.map((finding, index) => <div key={`${finding.title}-${index}`}><div className={cn("font-semibold", finding.severity === "critical" || finding.severity === "high" ? "text-critical" : "text-medium")}>{finding.title}</div><p className="mt-1 text-sm text-muted">{finding.plainEnglish}</p><p className="mt-1 text-sm font-medium">{finding.recommendation}</p></div>)}</div>
        </ResultCard>
      ) : null}

      <ResultCard>
        <h2 className="text-lg font-bold">In Simple Terms</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">{result.summaryBullets.map((bullet, index) => <li key={index}>• {bullet}</li>)}</ul>
      </ResultCard>

      <ResultCard>
        <h2 className="text-lg font-bold">What Changes?</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {result.changes.balances.map((balance) => <Change key={balance.asset} label={`${balance.asset} balance`} value={`${balance.beforeFormatted} → ${balance.afterFormatted}`} />)}
          <Change label="Owners" value={result.changes.owners.added.length || result.changes.owners.removed.length ? `+${result.changes.owners.added.join(", ") || "none"}; -${result.changes.owners.removed.join(", ") || "none"}` : "No changes"} />
          <Change label="Threshold" value={result.changes.threshold ? `${result.changes.threshold.before ?? "Unknown"} → ${result.changes.threshold.after}` : "No changes"} />
          <Change label="Modules" value={result.changes.modules.added.length || result.changes.modules.removed.length ? `+${result.changes.modules.added.join(", ") || "none"}; -${result.changes.modules.removed.join(", ") || "none"}` : "No changes"} />
          <Change label="Guard" value={result.changes.guard ? `${result.changes.guard.before ?? "None"} → ${result.changes.guard.after ?? "None"}` : "No changes"} />
          <Change label="Fallback handler" value={result.changes.fallbackHandler ? `${result.changes.fallbackHandler.before ?? "None"} → ${result.changes.fallbackHandler.after ?? "None"}` : "No changes"} />
        </div>
        {result.changes.balances.length ? <p className="mt-3 text-xs text-muted">{balanceSource}</p> : null}
      </ResultCard>

      <ResultCard>
        <h2 className="text-lg font-bold">Decoded Actions</h2>
        <div className="mt-3 space-y-2">{result.actions.map((action, index) => <Action key={index} action={action} resolveEnabled={resolveEnabled} />)}</div>
      </ResultCard>

      {result.execCalldata ? <ExecutionCalldataCard execCalldata={result.execCalldata} execCalldataHash={result.execCalldataHash} readyToExecute={result.signerContext?.readyToExecute ?? false} /> : null}

      <ResultCard>
        <details>
          <summary className="cursor-pointer text-lg font-bold">Technical Details</summary>
          <dl className="mt-4 grid gap-3 text-sm">
            <Technical label="Safe" value={result.input.safeAddress} />
            <Technical label="To" value={result.input.to} />
            <Technical label="Value" value={result.input.value} />
            <Technical label="Data" value={result.input.data} />
            <Technical label="Operation" value={String(result.input.operation)} />
            <Technical label="Nonce" value={result.input.nonce} />
            <Technical label="Gas price" value={result.input.gasPrice} />
            <Technical label="Gas token" value={result.input.gasToken} />
            <Technical label="Refund receiver" value={result.input.refundReceiver} />
          </dl>
        </details>
      </ResultCard>

      <ResultCard>
        <h2 className="text-lg font-bold">Recommendation</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{result.recommendation}</p>
        {result.limitations.map((item) => <p key={item} className="mt-2 text-sm text-medium">⚠ {item}</p>)}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => download("transaction-inspector.md", createXRayMarkdown(result), "text/markdown")}><Download className="h-4 w-4" />Export Markdown</Button>
          <Button variant="secondary" onClick={() => download("transaction-inspector.json", createXRayJson(result), "application/json")}><FileJson className="h-4 w-4" />Export JSON</Button>
        </div>
      </ResultCard>
    </div>
  );
}

function SignerContextCard({ context }: { context: XRayResult["signerContext"] }) {
  if (!context) return null;
  const tone = context.readyToExecute ? "border-warning-border/40 bg-warning-soft" : context.isFinalSigner ? "border-critical/40 bg-critical-soft" : "";
  return (
    <ResultCard className={tone}>
      <p className="eyebrow">Signer Context</p>
      <p className="mt-1 text-sm">
        Signed by <strong>{context.confirmations}</strong> of <strong>{context.confirmationsRequired}</strong> required owners.
      </p>
      <p className="mt-1 text-xs text-muted-faint">Confirmation count is sourced from the Safe Transaction Service API and is not independently verified locally.</p>
      {context.isFinalSigner ? <p className="mt-2 text-sm font-semibold text-critical">⚠ You would be the final signer — your signature executes this transaction.</p> : null}
      {context.readyToExecute ? <p className="mt-2 text-sm font-semibold text-warning">⚠ This transaction already has enough signatures to execute.</p> : null}
    </ResultCard>
  );
}

function SimulationCard({ simulation }: { simulation: NonNullable<XRayResult["simulation"]> }) {
  const ok = simulation.status === "success";
  const tone = ok ? "border-success-border/40 bg-success-soft" : simulation.status === "reverted" ? "border-critical/40 bg-critical-soft" : "border-rule";
  const label = ok ? "Simulation: succeeds" : simulation.status === "reverted" ? "Simulation: reverts" : "Simulation: unavailable";
  return (
    <ResultCard className={tone}>
      <p className="eyebrow">External Simulation by GoPlus</p>
      <h2 className={cn("mt-1 text-lg font-bold", ok ? "text-success" : simulation.status === "reverted" ? "text-critical" : "text-muted")}>{label}</h2>
      {simulation.revertReason ? <p className="mt-1 break-all font-mono text-xs text-critical">{simulation.revertReason}</p> : null}
      {simulation.note ? <p className="mt-1 text-xs text-muted">{simulation.note}</p> : null}
      {simulation.advisory ? <p className="mt-2 rounded-md border border-medium/40 bg-warning-soft p-2 text-xs text-medium">{simulation.advisory}</p> : null}
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Change label="Result" value={ok ? "Call succeeded" : simulation.status === "reverted" ? "Call reverted" : "Unavailable"} />
        <Change label="Gas used" value={simulation.gasUsed ?? "Not reported"} />
        <Change label="GoPlus risk flag" value={simulation.flagged === undefined ? "Not reported" : simulation.flagged ? "Flagged" : "No flag reported"} />
      </div>
      {simulation.balanceDeltas.length ? (
        <ul className="mt-2 space-y-1 text-sm">{simulation.balanceDeltas.map((delta) => <li key={delta.asset}>• {delta.asset}: {delta.deltaFormatted}</li>)}</ul>
      ) : null}
      <p className="mt-2 text-xs text-muted">Transaction fields were sent to GoPlus for execution against current chain state. No transaction was broadcast.</p>
    </ResultCard>
  );
}

function TransactionDataCard({ input }: { input: XRayResult["input"] }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(input.data);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }
  return (
    <ResultCard className="border-accent/40 bg-accent-soft">
      <p className="eyebrow">Primary signer check</p>
      <h2 className="mt-1 text-lg font-bold">What you are approving</h2>
      <p className="mt-2 text-sm text-muted">Confirm the destination, amount, and decoded action match what you intend. These are the transaction fields protected by the Safe transaction hash.</p>
      <dl className="mt-3 grid gap-3 text-sm">
        <Technical label="Destination" value={input.to} />
        <Technical label="Native value" value={input.value} />
      </dl>
      <details className="glass-chip mt-4 rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Show raw calldata</summary>
        <p className="mt-2 text-xs leading-relaxed text-muted">This is the calldata the Safe forwards to the destination contract — the &quot;Data&quot; field shown in the Safe app, not the final broadcast payload.</p>
        <p className="mt-3 break-all font-mono text-xs text-muted">{input.data}</p>
        <Button className="mt-3" variant="secondary" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy calldata"}</Button>
      </details>
    </ResultCard>
  );
}

function ExecutionCalldataCard({ execCalldata, execCalldataHash, readyToExecute }: { execCalldata: string; execCalldataHash?: string; readyToExecute: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(execCalldata);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }
  return (
    <ResultCard>
      <details>
        <summary className="cursor-pointer text-lg font-bold">Advanced: final execution payload</summary>
        <p className="eyebrow mt-4">execTransaction calldata</p>
        <p className={cn("mt-2 text-sm font-semibold", readyToExecute ? "text-warning" : "text-muted")}>{readyToExecute ? "Enough signatures have been reported for execution." : "This transaction is not yet reported as ready to execute."}</p>
        <p className="mt-2 text-sm text-muted">This is the complete call an executor broadcasts to the Safe contract. Most signers should verify the transaction hash and the action above instead. Compare this raw value only when your hardware wallet or execution tool displays the full <code>execTransaction</code> payload.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy execution payload"}</Button>
        </div>
        <p className="mt-3 break-all font-mono text-xs text-muted">{execCalldata}</p>
        {execCalldataHash ? <p className="mt-2 break-all font-mono text-xs text-muted-faint">Execution payload hash: {execCalldataHash}</p> : null}
      </details>
    </ResultCard>
  );
}

function integrityLabel(status: XRayResult["hashCheck"]["status"]) {
  return status === "match" ? "HASH: ✓ Verified" : status === "mismatch" ? "HASH: ✕ Mismatch" : "HASH: ✕ Unverified";
}
function integrityExplanation(status: XRayResult["hashCheck"]["status"]) {
  return status === "match"
    ? "Locally recomputed hash matches the provided Safe transaction hash."
    : status === "mismatch"
      ? "The locally recomputed hash does NOT match the imported Safe transaction hash. Do not sign until reviewed."
      : status === "unsupported"
        ? "Local hash verification is unsupported for this Safe version (requires v1.3.0+)."
        : "No provided Safe transaction hash is available for local comparison (common for manual input).";
}
function reputationBadge(reputation?: AddressReputation) {
  if (!reputation || reputation.status === "unknown") return null;
  if (reputation.status === "known_good") return <span className="ml-2 rounded border border-success-border/50 bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success" title={reputation.source}>✓ {reputation.label ?? "known"}</span>;
  return <span className="ml-2 rounded border border-critical/50 bg-critical-soft px-1.5 py-0.5 text-[10px] font-semibold text-critical" title={reputation.source}>⚠ {reputation.label ?? "suspicious"}</span>;
}
function ResultCard({ children, className }: { children: React.ReactNode; className?: string }) { return <Card className={cn("p-5", className)}>{children}</Card>; }
function Change({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-accent-soft p-3"><div className="text-xs font-semibold text-muted">{label}</div><div className="mt-1 break-all font-mono text-xs">{value}</div></div>; }
function Technical({ label, value }: { label: string; value: string }) { return <div><dt className="font-semibold">{label}</dt><dd className="mt-1 break-all font-mono text-xs text-muted">{value}</dd></div>; }
function Action({ action, resolveEnabled = false }: { action: XRayResult["actions"][number]; resolveEnabled?: boolean }) {
  const symbol = action.amountFormatted?.split(" ").at(-1);
  const tokenLabel = action.tokenName && symbol && action.tokenName !== symbol ? `${action.tokenName} (${symbol})` : action.tokenName;
  const isUnresolvedUnknown = action.type === "unknown_contract_call" && action.reputation?.status !== "known_good";
  return (
    <div className="rounded-md border border-rule p-3">
      <div className="font-semibold">{action.title}{reputationBadge(action.reputation)}{resolutionBadge(action.resolutionNote)}</div>
      {tokenLabel && action.tokenExplorerUrl ? <a className="mt-1 inline-block text-sm font-semibold text-accent underline underline-offset-2" href={action.tokenExplorerUrl} target="_blank" rel="noopener noreferrer">{tokenLabel}</a> : null}
      <p className="mt-1 text-sm text-muted">{action.plainEnglish}</p>
      {isUnresolvedUnknown ? (
        <p className="mt-1 text-xs font-medium text-medium">
          {resolveEnabled
            ? "Online resolution could not decode this call. Manual review is required; check the contract on a block explorer."
            : "Manual review is required. Tip: turn on \"Resolve unknown calls online\" to try decoding this call."}
        </p>
      ) : null}
      {action.amountFormatted && action.amountRaw ? <p className="mt-1 font-mono text-xs text-muted-faint">{action.amountFormatted} (raw: {action.amountRaw})</p> : null}
      {action.selector ? <p className="mt-1 font-mono text-[10px] text-muted-faint">selector {action.selector}</p> : null}
      {action.children?.map((child, index) => <div key={index} className="mt-2 border-l-2 border-rule pl-3"><Action action={child} resolveEnabled={resolveEnabled} /></div>)}
    </div>
  );
}
function resolutionBadge(note: DecodedAction["resolutionNote"]) {
  if (!note) return null;
  if (note === "verified-abi") {
    return <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600" title="Decoded from the contract's verified ABI on Sourcify.">verified ABI</span>;
  }
  return <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600" title="Function name resolved from a public 4-byte signature database. Selector collisions are possible — confirm against the contract.">unverified signature</span>;
}
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
