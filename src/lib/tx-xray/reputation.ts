import { getAddress, type Address } from "viem";
import reputationData from "./data/reputation.json";
import type { AddressReputation } from "./types";

/**
 * A single entry in the reputation JSON. Deserialized here to keep the public
 * API typed; the JSON file itself is the human-editable source.
 */
type ReputationEntry = {
  address: string;
  label: string;
  source: string;
};

/**
 * Look up address reputation using the bundled Layer-0 static list. This is
 * always available, requires no keys or network calls, and matches the existing
 * `classifyKnownComponent` pattern.
 *
 * Keyed by lowercased address within chain-specific and chain-agnostic buckets.
 * Unknown addresses return `{ status: "unknown" }` — callers should render that
 * as neutral rather than implying "clean".
 */
export function lookupReputation(address: Address, chainId: number): AddressReputation {
  const key = address.toLowerCase();

  // Chain-agnostic entries (e.g. Permit2) apply to every network.
  for (const entry of reputationData.chainAgnostic.knownGood as ReputationEntry[]) {
    if (entry.address.toLowerCase() === key) {
      return { status: "known_good", label: entry.label, source: entry.source };
    }
  }
  const knownBadChainAgnostic = (reputationData.chainAgnostic as Record<string, ReputationEntry[]> | undefined)?.knownBad;
  if (knownBadChainAgnostic) {
    for (const entry of knownBadChainAgnostic) {
      if (entry.address.toLowerCase() === key) {
        return { status: "suspicious", label: entry.label, source: entry.source };
      }
    }
  }

  // Chain-specific entries.
  const chain = String(chainId);
  const chainData = (reputationData as unknown as Record<string, Record<string, ReputationEntry[]>>)[chain];
  if (chainData) {
    for (const entry of chainData.knownGood ?? []) {
      if (entry.address.toLowerCase() === key) {
        return { status: "known_good", label: entry.label, source: entry.source };
      }
    }
    for (const entry of chainData.knownBad ?? []) {
      if (entry.address.toLowerCase() === key) {
        return { status: "suspicious", label: entry.label, source: entry.source };
      }
    }
  }

  return { status: "unknown" };
}

/**
 * Batch reputation check for multiple addresses. Used during enrichment to
 * annotate every `DecodedAction.addressesInvolved`.
 */
export function lookupBatchReputation(
  addresses: Address[],
  chainId: number,
): Map<string, AddressReputation> {
  const results = new Map<string, AddressReputation>();
  for (const addr of addresses) {
    const safe = getAddress(addr);
    if (!results.has(safe)) {
      results.set(safe, lookupReputation(safe, chainId));
    }
  }
  return results;
}
