import { getAddress } from "viem";
import { SAFE_PREFIX_TO_CHAIN } from "../chains/safePrefixes";

export function parseSafeUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid Safe URL."); }
  if (url.protocol !== "https:") throw new Error("Enter an https:// Safe URL.");

  // Format 1: Safe app URL — https://app.safe.global/...?safe=eth:0x...
  if (url.hostname === "app.safe.global") {
    const safe = url.searchParams.get("safe");
    if (!safe) throw new Error("Safe URL does not include a Safe address.");
    const split = safe.indexOf(":");
    const prefix = split >= 0 ? safe.slice(0, split) : "";
    const chainId = SAFE_PREFIX_TO_CHAIN[prefix];
    if (!chainId) throw new Error("Safe URL uses an unsupported network.");
    const safeAddress = getAddress(safe.slice(split + 1));
    const rawId = url.searchParams.get("id") ?? url.searchParams.get("tx");
    const transactionId = rawId?.match(/0x[a-fA-F0-9]{64}/)?.[0];
    return { chainId, safeAddress, kind: transactionId ? "transaction" as const : url.pathname.includes("queue") ? "queue" as const : "home" as const, ...(transactionId ? { transactionId } : {}) };
  }

  // Format 2: Safe Transaction Service API URL —
  // https://api.safe.global/tx-service/{prefix}/api/v1/safes/{address}/multisig-transactions/
  // https://api.safe.global/tx-service/{prefix}/api/v1/multisig-transactions/{txHash}/
  if (url.hostname === "api.safe.global") {
    const match = url.pathname.match(/^\/tx-service\/([^/]+)\/api\/v1\/(?:safes\/(0x[a-fA-F0-9]{40})\/multisig-transactions\/|multisig-transactions\/(0x[a-fA-F0-9]{64})\/?)/);
    if (!match) throw new Error("Could not parse the Safe API URL. Expected a safes or multisig-transactions endpoint.");
    const prefix = match[1];
    const chainId = SAFE_PREFIX_TO_CHAIN[prefix];
    if (!chainId) throw new Error("Safe API URL uses an unsupported network.");
    if (match[3]) {
      // Specific transaction URL
      return { chainId, safeAddress: getAddress("0x0000000000000000000000000000000000000000"), kind: "transaction" as const, transactionId: match[3] };
    }
    // Pending transactions for a Safe
    return { chainId, safeAddress: getAddress(match[2]), kind: "queue" as const };
  }

  throw new Error("Enter an https://app.safe.global or https://api.safe.global Safe URL.");
}
