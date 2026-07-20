// GoPlus transaction_simulation supports a subset of the app's chains. This
// constant is the single source of truth shared by the server route and the
// client UI so the two cannot drift out of sync.
export const SIMULATION_SUPPORTED_CHAINS = new Map<number, string>([
  [1, "0x1"],
  [56, "0x38"],
  [8453, "0x2105"],
]);

export function isSimulationSupportedChain(chainId: number | null | undefined): boolean {
  return chainId !== null && chainId !== undefined && SIMULATION_SUPPORTED_CHAINS.has(chainId);
}
