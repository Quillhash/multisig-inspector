import type { PublicClient } from "viem";
import { getMainnetChains } from "../chains/chains";
import { createRpcClient } from "../chains/rpc";
import { SINGLETON_STORAGE_SLOT } from "./slots";
import { addressFromStorageValue } from "./slots";
import type { Address } from "./types";

export type ChainProbe = {
  hasCode: boolean;
  singleton: Address | null;
};

export async function detectSafeChain(
  chainIds: number[],
  probe: (chainId: number) => Promise<ChainProbe>,
): Promise<number | null> {
  const matches = await detectSafeChains(chainIds, probe);
  return matches[0] ?? null;
}

export async function detectSafeChains(
  chainIds: number[],
  probe: (chainId: number) => Promise<ChainProbe>,
): Promise<number[]> {
  const results = await Promise.all(
    chainIds.map(async (id) => {
      try {
        return { id, ...(await probe(id)) };
      } catch {
        return { id, hasCode: false, singleton: null };
      }
    }),
  );

  const safeMatches = results.filter(
    (result) => result.hasCode && result.singleton,
  );
  if (safeMatches.length > 0) {
    return safeMatches.map((result) => result.id);
  }

  return results.filter((result) => result.hasCode).map((result) => result.id);
}

export async function detectSafeChainForAddress(
  safeAddress: Address,
): Promise<number | null> {
  const matches = await detectSafeChainsForAddress(safeAddress);
  return matches[0] ?? null;
}

export async function detectSafeChainsForAddress(
  safeAddress: Address,
): Promise<number[]> {
  const mainnetChainIds = getMainnetChains().map((chain) => chain.id);
  return detectSafeChains(mainnetChainIds, (chainId) =>
    probeChain(chainId, safeAddress),
  );
}

async function probeChain(
  chainId: number,
  safeAddress: Address,
): Promise<ChainProbe> {
  const client = createRpcClient(chainId);
  const code = await safeGetCode(client, safeAddress);
  if (!code) return { hasCode: false, singleton: null };

  const slot = await client.getStorageAt({
    address: safeAddress,
    slot: SINGLETON_STORAGE_SLOT,
  });
  const singleton = slot ? addressFromStorageValue(slot) : null;
  return { hasCode: true, singleton };
}

async function safeGetCode(
  client: PublicClient,
  address: Address,
): Promise<boolean> {
  try {
    const code = await client.getCode({ address });
    return Boolean(code && code !== "0x");
  } catch {
    return false;
  }
}
