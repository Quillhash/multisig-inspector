export const SAFE_PREFIX_TO_CHAIN: Record<string, number> = {
  eth: 1,
  matic: 137,
  arb1: 42161,
  oeth: 10,
  base: 8453,
  gno: 100,
  bnb: 56,
  avax: 43114,
  sep: 11155111,
  basesep: 84532,
};

export function chainIdToSafePrefix(chainId: number): string | undefined {
  for (const [prefix, id] of Object.entries(SAFE_PREFIX_TO_CHAIN)) {
    if (id === chainId) return prefix;
  }
  return undefined;
}
