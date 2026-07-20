import { buildChanges } from "./buildChanges";
import { buildSummary, recommendation } from "./buildPlainEnglishSummary";
import { computeSafeTxHash } from "./computeSafeTxHash";
import { decodeCalldata } from "./decodeCalldata";
import { formatActionAmounts } from "./formatActionAmounts";
import { buildFindings, buildGasFindingsFromInput, buildSignerContextFindings, highestRisk } from "./scoreTransactionRisk";
import { lookupBatchReputation } from "./reputation";
import { buildExecTransactionCalldata } from "./buildExecTransactionCalldata";
import { keccak256, type Hex } from "viem";
import type { SafeTxEnrichment, SafeTxInput, XRayResult } from "./types";

function resolveSignatures(input: SafeTxInput): Hex | undefined {
  if (input.signatures && input.signatures.length > 2 && input.signatures !== "0x") return input.signatures;
  if (!input.confirmationDetails || input.confirmationDetails.length === 0) return undefined;
  const sorted = [...input.confirmationDetails].sort((a, b) => a.owner.toLowerCase().localeCompare(b.owner.toLowerCase()));
  const combined = `0x${sorted.map((c) => c.signature.slice(2)).join("")}` as Hex;
  return combined.length > 2 ? combined : undefined;
}

function canBuildExecutionCalldata(input: SafeTxInput): boolean {
  const signatures = resolveSignatures(input);
  if (!signatures) return false;
  if (input.confirmationsRequired === undefined) return true;
  if (input.confirmations === undefined) return false;
  return input.confirmations >= input.confirmationsRequired;
}

export function analyzeTransaction(
  input: SafeTxInput,
  enrichment: SafeTxEnrichment = { limitations: [] },
  simulation?: import("./types").TransactionSimulation,
  resolver?: import("./types").CallResolver,
): XRayResult {
  const hashCheck = computeSafeTxHash(input, enrichment.safeVersion);
  const rawActions = decodeCalldata(input, resolver);
  const actions = formatActionAmounts(rawActions, input, enrichment);

  // Layer-0 reputation annotation on every action's addresses.
  const allAddresses = collectAllAddresses(actions);
  const reputationMap = lookupBatchReputation(allAddresses, input.chainId);
  annotateReputation(actions, reputationMap);

  const decodedActions = flattenActions(actions);
  const changes = buildChanges(decodedActions, enrichment, input, simulation);
  const riskLimitations = enrichment.limitations.filter((item) => !item.startsWith("Token metadata") && !item.startsWith("Balance"));
  const findings = buildFindings(decodedActions, hashCheck, changes, riskLimitations, enrichment, Boolean(resolver));

  if (simulation?.flagged) {
    findings.push({
      severity: "high",
      title: "GoPlus transaction-risk signal",
      plainEnglish: "GoPlus flagged the simulated transaction for additional risk review.",
      technicalExplanation: "The external simulation returned flagged=true. This is advisory intelligence, not ground truth.",
      recommendation: "Do not sign until the transaction and every involved address are independently verified.",
      evidence: { provider: "GoPlus", flagged: true },
    });
  }

  // Gas/refund analysis — fields that were previously ignored.
  const gasFindings = buildGasFindingsFromInput(input);
  findings.push(...gasFindings);

  // Signer context — confirmation-based findings.
  const signerFindings = buildSignerContextFindings(input.confirmations, input.confirmationsRequired);
  findings.push(...signerFindings);

  const riskLevel = highestRisk(findings);

  const signerContext = input.confirmations !== undefined && input.confirmationsRequired !== undefined
    ? {
        confirmations: input.confirmations,
        confirmationsRequired: input.confirmationsRequired,
        isFinalSigner: input.confirmations === input.confirmationsRequired - 1,
        readyToExecute: input.confirmations >= input.confirmationsRequired,
      }
    : undefined;

  const signatures = canBuildExecutionCalldata(input) ? resolveSignatures(input) : undefined;
  const execCalldata = signatures ? buildExecTransactionCalldata(input, signatures) : undefined;
  const execCalldataHash = execCalldata ? keccak256(execCalldata) : undefined;

  return {
    input,
    hashCheck,
    actions,
    changes,
    findings,
    riskLevel,
    summaryBullets: buildSummary(decodedActions.filter((action) => action.type !== "multi_send")),
    recommendation: recommendation(riskLevel, hashCheck.status),
    limitations: enrichment.limitations,
    signerContext,
    simulation,
    execCalldata,
    execCalldataHash,
  };
}

function flattenActions(actions: XRayResult["actions"]): XRayResult["actions"] {
  return actions.flatMap((action) => [action, ...flattenActions(action.children ?? [])]);
}

/** Collect every unique address from the action tree for batch reputation lookup. */
function collectAllAddresses(actions: XRayResult["actions"]): XRayResult["actions"][number]["addressesInvolved"] {
  const seen = new Set<string>();
  const result: XRayResult["actions"][number]["addressesInvolved"] = [];
  function walk(actions: XRayResult["actions"]) {
    for (const action of actions) {
      for (const addr of action.addressesInvolved) {
        if (!seen.has(addr)) {
          seen.add(addr);
          result.push(addr);
        }
      }
      if (action.tokenAddress && !seen.has(action.tokenAddress)) {
        seen.add(action.tokenAddress);
        result.push(action.tokenAddress);
      }
      if (action.children) walk(action.children);
    }
  }
  walk(actions);
  return result;
}

/** Annotate each action with reputation data from the lookup map. */
function annotateReputation(actions: XRayResult["actions"], map: Map<string, import("./types").AddressReputation>): void {
  for (const action of actions) {
    // The primary reputation signal is on the first addressesInvolved entry
    // (the recipient/spender), plus the tokenAddress if present.
    const recipient = action.addressesInvolved[0];
    if (recipient && map.has(recipient)) {
      action.reputation = map.get(recipient);
    }
    // Also propagate to children.
    if (action.children) annotateReputation(action.children, map);
  }
}
