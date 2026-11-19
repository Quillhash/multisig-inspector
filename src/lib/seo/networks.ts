/**
 * Display names of supported networks for server-rendered copy.
 *
 * Kept as plain strings so server routes do not pull the viem chain registry
 * into their bundle. networks.test.ts fails if this drifts from chains.ts.
 */
export const MAINNET_NAMES = [
  "Ethereum",
  "Polygon",
  "Arbitrum One",
  "OP Mainnet",
  "Base",
  "Gnosis",
  "BNB Smart Chain",
  "Avalanche",
] as const;

export const TESTNET_NAMES = ["Sepolia", "Base Sepolia"] as const;
