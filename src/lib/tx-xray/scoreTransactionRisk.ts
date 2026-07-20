import { maxUint256 } from "viem";
import type { DecodedAction, SafeConfigChanges, SafeTxEnrichment, SafeTxHashCheck, XRayFinding, XRaySeverity } from "./types";

const rank: Record<XRaySeverity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** If a transfer moves more than this fraction of the Safe's known balance, escalate. */
const HIGH_VALUE_TRANSFER_RATIO = 0.5;

/**
 * Returns the integer percentage of the balance this transfer represents when
 * the ratio exceeds HIGH_VALUE_TRANSFER_RATIO and does not exceed 100%.
 * Returns null otherwise. All math is done in bigint to avoid precision loss
 * for large raw amounts (e.g. 18-decimal tokens in whale Safes).
 */
function highValueTransferPercent(transfer: bigint, balance: bigint): number | null {
  if (balance <= 0n) return null;
  if (transfer > balance) return null; // ratio > 1, not a high-value flag
  // percent = (transfer * 100) / balance — bigint-safe
  const percentBigint = (transfer * 100n) / balance;
  const percent = Number(percentBigint);
  if (percent / 100 > HIGH_VALUE_TRANSFER_RATIO) return percent;
  return null;
}

export function buildFindings(actions: DecodedAction[], hash: SafeTxHashCheck, changes: SafeConfigChanges, limitations: string[], enrichment?: SafeTxEnrichment, resolveEnabled = false): XRayFinding[] {
  const findings: XRayFinding[] = [];
  if (hash.status === "mismatch") findings.push({ severity: "critical", title: "Transaction hash mismatch", plainEnglish: "The supplied hash does not match these transaction fields.", technicalExplanation: "Local EIP-712 recomputation differs from the imported hash.", recommendation: "Do not sign until manually reviewed.", incidentPattern: "api-integrity-risk" });
  if (changes.threshold?.before !== undefined && changes.threshold.after < changes.threshold.before && changes.threshold.after * 2 <= changes.threshold.before) findings.push({ severity: "critical", title: "Threshold materially lowered", plainEnglish: `The approval threshold changes from ${changes.threshold.before} to ${changes.threshold.after}.`, technicalExplanation: "The new threshold is no more than half the current threshold.", recommendation: "Do not sign until this control change is independently confirmed.", incidentPattern: "safe-control-change" });

  for (const action of actions) {
    // Delegatecall — critical by definition.
    if (action.type === "delegatecall") findings.push({ severity: "critical", title: "Transaction uses DELEGATECALL", plainEnglish: "External code can run in the Safe's context and modify Safe state.", technicalExplanation: action.technicalDetails, recommendation: "Do not sign without a trusted technical review.", incidentPattern: "delegatecall-risk" });

    // Token approval — escalate for unlimited.
    if (action.type === "erc20_approve") {
      const isUnlimited = action.amountRaw === maxUint256.toString();
      const reputation = action.reputation;
      // A known-bad spender with any approval is critical.
      if (reputation?.status === "suspicious") {
        findings.push({ severity: "critical", title: `Approval to suspicious address ${reputation.label ?? action.addressesInvolved[0]}`, plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation: "Do not sign. The spender address is flagged as suspicious.", incidentPattern: "address-reputation-risk", evidence: { reputation } });
      } else {
        findings.push({ severity: isUnlimited ? "high" : "medium", title: isUnlimited ? "Unlimited token approval" : "Token approval", plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation: "Verify the spender address and allowance out-of-band.", incidentPattern: "allowance-risk" });
      }
    }

    // Permit2 transfer — always high (signed-permit vector).
    if (action.type === "permit2_transfer") findings.push({ severity: "high", title: "Permit2 signed transfer", plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation: "Verify the Permit2 spender, token, and amount out-of-band. Permit2 transfers use a stored signature and can drain without a separate on-chain approval.", incidentPattern: "allowance-risk" });
    if (action.type === "permit2_permit") findings.push({ severity: "high", title: "Permit2 approval grant", plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation: "Verify the spender and tokens. Once permitted, the spender can transfer tokens from this Safe without further approvals.", incidentPattern: "allowance-risk" });

    // NFT blanket approval.
    if (action.type === "erc721_approve_all") findings.push({ severity: "high", title: "NFT blanket approval", plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation: "setApprovalForAll grants full control. Verify the operator out-of-band.", incidentPattern: "allowance-risk" });

    // ERC-20 / ETH transfers to suspicious addresses — critical.
    if ((action.type === "erc20_transfer" || action.type === "eth_transfer") && action.reputation?.status === "suspicious") {
      findings.push({ severity: "critical", title: `Transfer to suspicious address ${action.reputation.label ?? action.addressesInvolved[0]}`, plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation: "Do not sign. The recipient address is flagged as suspicious.", incidentPattern: "address-reputation-risk", evidence: { reputation: action.reputation } });
    }

    // ERC-20 transfer — check high-value ratio against known balance.
    if (action.type === "erc20_transfer" && enrichment && action.tokenAddress && action.amountRaw) {
      const transferAmount = BigInt(action.amountRaw);
      const balance = enrichment.assetBalances?.tokens[action.tokenAddress.toLowerCase()];
      if (balance) {
        const balanceBigint = BigInt(balance);
        const percent = highValueTransferPercent(transferAmount, balanceBigint);
        if (percent !== null) {
          findings.push({ severity: "medium", title: "High-value token transfer", plainEnglish: `This transfer moves ~${percent}% of the Safe's known ${action.tokenName ?? "token"} balance.`, technicalExplanation: `Transfer: ${transferAmount} / Balance: ${balance}`, recommendation: "Confirm the amount and recipient are expected.", incidentPattern: "high-value-transfer" });
        }
      }
    }

    // Native ETH transfer — check high-value ratio.
    if (action.type === "eth_transfer" && enrichment && action.amountRaw) {
      const transferAmount = BigInt(action.amountRaw);
      const balance = enrichment.assetBalances?.native;
      if (balance) {
        const balanceBigint = BigInt(balance);
        const percent = highValueTransferPercent(transferAmount, balanceBigint);
        if (percent !== null) {
          const chain = action.amountFormatted?.split(" ").at(-1) ?? "ETH";
          findings.push({ severity: "medium", title: "High-value native transfer", plainEnglish: `This transfer moves ~${percent}% of the Safe's known ${chain} balance.`, technicalExplanation: `Transfer: ${transferAmount} / Balance: ${balance}`, recommendation: "Confirm the amount and recipient are expected.", incidentPattern: "high-value-transfer" });
        }
      }
    }

    // Unknown calldata.
    if (action.type === "unknown_contract_call") {
      // Downgrade to low when the contract is known-good.
      const isKnownGood = action.reputation?.status === "known_good";
      const recommendation = isKnownGood
        ? "Manual review is required before signing."
        : resolveEnabled
          ? "Manual review is required before signing. Online resolution could not decode this call; check the contract on a block explorer."
          : "Manual review is required before signing. Tip: turn on \"Resolve unknown calls online\" below to try decoding this call from public contract directories.";
      findings.push({ severity: isKnownGood ? "low" : "medium", title: isKnownGood ? `Call to recognized contract (${action.reputation?.label})` : action.title, plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation, incidentPattern: "unknown-calldata" });
    }

    // Partial batch decode.
    if (action.type === "unknown" && action.title === "Partial batch decode") findings.push({ severity: "medium", title: "Partial batch decode", plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation: "Review the remaining batch actions manually before signing.", incidentPattern: "unknown-calldata" });

    // Safe control change — escalate for modules and threshold=1.
    if (action.type === "safe_admin") {
      const critical = action.adminEffect?.kind === "enable_module" || ((action.adminEffect?.kind === "change_threshold" || action.adminEffect?.kind === "add_owner" || action.adminEffect?.kind === "remove_owner") && action.adminEffect.threshold === 1);
      findings.push({ severity: critical ? "critical" : "high", title: "Safe control change", plainEnglish: action.plainEnglish, technicalExplanation: action.technicalDetails, recommendation: "Do not sign until reviewed by a trusted technical reviewer.", incidentPattern: action.adminEffect?.kind === "enable_module" ? "hidden-side-door" : "safe-control-change" });
    }
  }

  // Empty transaction to a weird address — suspicious.
  for (const action of actions) {
    if (action.type === "unknown" && action.title === "Empty transaction") {
      findings.push({ severity: "low", title: "Empty transaction", plainEnglish: "This transaction sends no value and carries no calldata. It may be a nonce probe or administrative placeholder.", technicalExplanation: `to=${action.addressesInvolved[0]}`, recommendation: "Confirm this transaction is expected." });
    }
  }

  // Limitations.
  for (const limitation of limitations) findings.push({ severity: "medium", title: "Analysis limitation", plainEnglish: limitation, technicalExplanation: limitation, recommendation: "Review the raw transaction fields manually." });
  return findings;
}

/**
 * Analyze the gas/refund fields of the outermost transaction input for
 * known gas-refund drain vectors. These fields are part of the EIP-712
 * signed message, so they should not be silently accepted.
 */
export function buildGasFindingsFromInput(input: { gasPrice: string; gasToken: string; refundReceiver: string }): XRayFinding[] {
  const ZERO = "0x0000000000000000000000000000000000000000";
  const findings: XRayFinding[] = [];

  // Relayer refund paid in a held token — known drain vector.
  if (BigInt(input.gasPrice) > 0n && input.gasToken.toLowerCase() !== ZERO) {
    findings.push({
      severity: "high",
      title: "Gas refund uses a held token",
      plainEnglish: `The transaction pays gas refunds using token ${input.gasToken}. This is a known drain vector when the gasPrice is set high.`,
      technicalExplanation: `gasPrice=${input.gasPrice}, gasToken=${input.gasToken}`,
      recommendation: "Verify the gasToken and gasPrice are expected. High gasPrice + non-zero gasToken can drain the Safe's token balance.",
      incidentPattern: "gas-refund-risk",
    });
  }

  // Refund receiver is an arbitrary address — medium risk.
  if (input.refundReceiver.toLowerCase() !== ZERO) {
    findings.push({
      severity: "medium",
      title: "Gas refund goes to a specific address",
      plainEnglish: `Gas refunds are sent to ${input.refundReceiver} instead of the tx sender.`,
      technicalExplanation: `refundReceiver=${input.refundReceiver}`,
      recommendation: "Verify this address is expected.",
      incidentPattern: "gas-refund-risk",
    });
  }

  return findings;
}

/**
 * Build signer-context findings. Called when confirmation data is available.
 */
export function buildSignerContextFindings(
  confirmations: number | undefined,
  confirmationsRequired: number | undefined,
): XRayFinding[] {
  if (confirmations === undefined || confirmationsRequired === undefined) return [];

  const findings: XRayFinding[] = [];

  // Already has enough confirmations to execute — unusual and a risk signal.
  if (confirmations >= confirmationsRequired) {
    findings.push({
      severity: "medium",
      title: "Transaction already has enough signatures",
      plainEnglish: `This transaction has ${confirmations} of ${confirmationsRequired} required confirmations and can be executed immediately.`,
      technicalExplanation: `confirmations=${confirmations}, confirmationsRequired=${confirmationsRequired}`,
      recommendation: "Verify this transaction is expected before anyone executes it.",
      incidentPattern: "signer-context-risk",
    });
  }

  return findings;
}

export function highestRisk(findings: XRayFinding[]): "low" | "medium" | "high" | "critical" {
  const severity = findings.reduce<XRaySeverity>((max, item) => rank[item.severity] > rank[max] ? item.severity : max, "low");
  return severity === "info" ? "low" : severity;
}
