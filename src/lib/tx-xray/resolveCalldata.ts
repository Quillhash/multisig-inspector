import type { Abi } from "viem";
import { decodeCalldata } from "./decodeCalldata";
import type { CallResolver, DecodedAction, SafeTxInput } from "./types";

const RESOLVE_URL = "/api/xray/resolve";
type Fetcher = typeof fetch;

function flatten(actions: DecodedAction[]): DecodedAction[] {
  return actions.flatMap((action) => [action, ...flatten(action.children ?? [])]);
}

/**
 * Opt-in Layer-1 resolution for calls the offline decoder cannot recognize.
 *
 * A first offline decode identifies the unknown calls; for each unique
 * (target, selector) we ask the server proxy to resolve a verified ABI
 * (Sourcify) and/or a 4-byte function signature. The resulting maps are threaded
 * back into `decodeCalldata` so the unknown calls decode into readable actions.
 *
 * Fields leave the browser only when the user enables this, mirroring the
 * opt-in GoPlus simulation model.
 */
export async function resolveCalls(input: SafeTxInput, fetcher: Fetcher = fetch): Promise<CallResolver> {
  const abis = new Map<string, Abi>();
  const signatures = new Map<string, string>();

  const unknown = flatten(decodeCalldata(input)).filter(
    (action) => action.type === "unknown_contract_call" && action.selector && action.addressesInvolved[0],
  );

  const seen = new Set<string>();
  for (const action of unknown) {
    const address = action.addressesInvolved[0];
    const selector = action.selector as string;
    const key = `${address.toLowerCase()}:${selector.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const response = await fetcher(RESOLVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainId: input.chainId, address, selector }),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { abi?: unknown[] | null; signature?: string | null };
      if (Array.isArray(data.abi) && data.abi.length > 0) {
        abis.set(address.toLowerCase(), data.abi as Abi);
      }
      if (typeof data.signature === "string" && data.signature) {
        signatures.set(selector.toLowerCase(), data.signature);
      }
    } catch {
      // best-effort: skip this call, keep resolving the rest
    }
  }

  return { abis, signatures };
}
