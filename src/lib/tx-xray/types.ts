import type { Address, Hex } from "viem";

export type XRaySource = "manual" | "json" | "safe-api";
export type XRaySeverity = "info" | "low" | "medium" | "high" | "critical";

export type SafeTxConfirmation = {
  owner: Address;
  signature: Hex;
  signatureType: string;
};

export type SafeTxInput = {
  source: XRaySource;
  safeAddress: Address;
  chainId: number;
  to: Address;
  value: string;
  data: Hex;
  operation: 0 | 1;
  nonce: string;
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: Address;
  refundReceiver: Address;
  providedSafeTxHash?: Hex;
  apiTxHash?: Hex;
  signatures?: Hex;
  confirmationDetails?: SafeTxConfirmation[];
  confirmations?: number;
  confirmationsRequired?: number;
};

export type SafeConfigState = {
  owners: Address[];
  threshold: number;
  modules: Address[];
  guard: Address | null;
  fallbackHandler: Address | null;
};

export type SafeTxEnrichment = {
  safeVersion?: string;
  currentConfig?: SafeConfigState;
  tokenMetadata?: Record<string, TokenMetadata>;
  assetBalances?: {
    native?: string;
    tokens: Record<string, string>;
  };
  /** Lowercased addresses of contracts confirmed to implement ERC-721 at enrichment time. */
  erc721Contracts?: Set<string>;
  limitations: string[];
};

export type TokenMetadata = {
  decimals: number;
  symbol: string;
  name?: string;
};

export type AdminEffect =
  | { kind: "add_owner"; owner: Address; threshold: number }
  | { kind: "remove_owner"; owner: Address; threshold: number }
  | { kind: "swap_owner"; oldOwner: Address; newOwner: Address }
  | { kind: "change_threshold"; threshold: number }
  | { kind: "enable_module"; module: Address }
  | { kind: "disable_module"; module: Address }
  | { kind: "set_guard"; guard: Address }
  | { kind: "set_fallback"; handler: Address };

/**
 * Optional Layer-1 resolution for calldata whose selector is not covered by the
 * offline decoder. Built by `resolveCalls` from an opt-in online lookup
 * (verified contract ABI via Sourcify, or a function signature via a 4-byte
 * directory) and threaded into the decoder so unknown calls become readable.
 */
export type CallResolver = {
  abis: Map<string, import("viem").Abi>;
  signatures: Map<string, string>;
};

export type DecodedAction = {
  type:
    | "eth_transfer"
    | "erc20_transfer"
    | "erc20_approve"
    | "erc20_transfer_from"
    | "erc721_transfer"
    | "erc721_approve_all"
    | "erc1155_transfer"
    | "permit2_permit"
    | "permit2_transfer"
    | "swap"
    | "safe_admin"
    | "access_control"
    | "contract_call"
    | "unknown_contract_call"
    | "delegatecall"
    | "multi_send"
    | "unknown";
  title: string;
  plainEnglish: string;
  technicalDetails: string;
  addressesInvolved: Address[];
  tokenAddress?: Address;
  amountRaw?: string;
  amountFormatted?: string;
  tokenName?: string;
  tokenExplorerUrl?: string;
  adminEffect?: AdminEffect;
  selector?: Hex;
  reputation?: AddressReputation;
  /**
   * Provenance for resolved calls: "verified-abi" = decoded from the contract's
   * verified ABI (Sourcify), "unverified-signature" = name came from a 4-byte
   * signature directory (collisions possible). Rendered as a badge so the
   * plain-English sentence stays clean.
   */
  resolutionNote?: "verified-abi" | "unverified-signature";
  children?: DecodedAction[];
};

/**
 * Layer-0 (bundled static list) and Layer-1 (live GoPlus via server route).
 * `status: "unknown"` is the default when no reputation data is available so the
 * UI can render a neutral state rather than implying "clean".
 */
export type AddressReputationStatus = "known_good" | "suspicious" | "unknown";
export type AddressReputation = {
  status: AddressReputationStatus;
  label?: string;
  source?: string;
};

export type XRayFinding = {
  severity: XRaySeverity;
  title: string;
  plainEnglish: string;
  technicalExplanation: string;
  recommendation: string;
  evidence?: Record<string, unknown>;
  incidentPattern?: "signer-deception" | "blind-signing" | "safe-control-change" | "hidden-side-door" | "delegatecall-risk" | "allowance-risk" | "unknown-calldata" | "api-integrity-risk" | "gas-refund-risk" | "address-reputation-risk" | "high-value-transfer" | "signer-context-risk";
};

export type SafeTxHashCheck = {
  recomputedSafeTxHash?: Hex;
  providedSafeTxHash?: Hex;
  matches?: boolean;
  status: "not_provided" | "match" | "mismatch" | "unsupported";
};

export type SafeConfigChanges = {
  owners: { added: Address[]; removed: Address[] };
  threshold?: { before?: number; after: number };
  modules: { added: Address[]; removed: Address[] };
  guard?: { before: Address | null; after: Address | null };
  fallbackHandler?: { before: Address | null; after: Address | null };
  balances: Array<{
    asset: string;
    tokenAddress?: Address;
    explorerUrl?: string;
    beforeRaw: string;
    afterRaw: string;
    beforeFormatted: string;
    afterFormatted: string;
  }>;
};

export type XRayResult = {
  input: SafeTxInput;
  hashCheck: SafeTxHashCheck;
  actions: DecodedAction[];
  findings: XRayFinding[];
  changes: SafeConfigChanges;
  riskLevel: "low" | "medium" | "high" | "critical";
  summaryBullets: string[];
  recommendation: string;
  limitations: string[];
  signerContext?: SignerContext;
  simulation?: TransactionSimulation;
  execCalldata?: Hex;
  execCalldataHash?: Hex;
};

/**
 * Confirmation state pulled from the Safe Transaction Service.
 * `isFinalSigner` is true when exactly one more signature would execute the tx.
 */
export type SignerContext = {
  confirmations: number;
  confirmationsRequired: number;
  isFinalSigner: boolean;
  readyToExecute: boolean;
};

/**
 * Layer-1 simulation output. When present, `changes.balances` reflects the
 * simulated post-state rather than the arithmetic Layer-0 projection.
 */
export type TransactionSimulation = {
  provider: "goplus";
  status: "success" | "reverted" | "failed";
  balanceDeltas: Array<{
    asset: string;
    tokenAddress?: Address;
    explorerUrl?: string;
    deltaRaw: string;
    deltaFormatted: string;
    beforeRaw?: string;
    afterRaw?: string;
  }>;
  gasUsed?: string;
  flagged?: boolean;
  revertReason?: string;
  note?: string;
  advisory?: string;
};
