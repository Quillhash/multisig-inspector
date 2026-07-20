import { getAddress, isAddress, isHex, zeroAddress, type Address, type Hex } from "viem";
import type { SafeTxConfirmation, SafeTxInput, XRaySource } from "./types";

export type RawSafeTx = {
  [key: string]: unknown;
  source: XRaySource;
  safeAddress?: unknown;
  chainId?: unknown;
  to?: unknown;
  value?: unknown;
  data?: unknown;
  operation?: unknown;
  nonce?: unknown;
};

function address(value: unknown, label: string, fallback?: Address): Address {
  const candidate = value ?? fallback;
  if (typeof candidate !== "string" || !isAddress(candidate)) throw new Error(`${label} must be a valid address.`);
  return getAddress(candidate);
}

function quantity(value: unknown, label: string, fallback?: string): string {
  const candidate = value ?? fallback;
  const text = typeof candidate === "number" || typeof candidate === "bigint" ? String(candidate) : candidate;
  if (typeof text !== "string" || !/^\d+$/.test(text)) throw new Error(`${label} must be an unsigned integer.`);
  return BigInt(text).toString();
}

function toPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 ? value : undefined;
  const text = typeof value === "string" ? value : typeof value === "bigint" ? String(value) : "";
  if (!/^\d+$/.test(text)) return undefined;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalizeSignatures(value: unknown): Hex | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !isHex(value)) throw new Error("signatures must be a 0x-prefixed hex string.");
  return value;
}

function normalizeConfirmationDetails(value: unknown): SafeTxConfirmation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const confirmations = value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`confirmation at index ${index} is malformed.`);
    const record = item as Record<string, unknown>;
    const owner = typeof record.owner === "string" && isAddress(record.owner) ? getAddress(record.owner) : undefined;
    const signature = typeof record.signature === "string" && isHex(record.signature) ? record.signature : undefined;
    const signatureType = typeof record.signatureType === "string" ? record.signatureType : "UNKNOWN";
    if (!owner || !signature) throw new Error(`confirmation at index ${index} is missing owner or signature.`);
    return { owner, signature, signatureType };
  });
  return Array.from(
    new Map(confirmations.map((confirmation) => [confirmation.owner, confirmation])).values(),
  );
}

function countSignaturesFromBytes(signatures: Hex | undefined): number | undefined {
  if (!signatures || signatures.length <= 2) return undefined;
  // EOA, ETH_SIGN, and APPROVED_HASH signatures are 65 bytes each.
  const count = (signatures.length - 2) / 130;
  return Number.isInteger(count) && count > 0 ? count : undefined;
}

export function normalizeSafeTx(raw: RawSafeTx): SafeTxInput {
  const chainId = Number(raw.chainId);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("chainId must be a supported positive integer.");
  if (raw.operation !== 0 && raw.operation !== 1) throw new Error("operation must be 0 (CALL) or 1 (DELEGATECALL).");
  if (typeof raw.data !== "string" || !isHex(raw.data)) throw new Error("data must be 0x-prefixed calldata.");
  const provided = raw.providedSafeTxHash;
  if (provided && (!isHex(provided) || provided.length !== 66)) throw new Error("safeTxHash must be 32 bytes.");

  const signatures = normalizeSignatures(raw.signatures);
  const confirmationDetails = normalizeConfirmationDetails(raw.confirmations);
  const confirmationsFromDetails = confirmationDetails?.length;
  const confirmationsFromSignatures = signatures ? countSignaturesFromBytes(signatures) : undefined;

  return {
    source: raw.source,
    safeAddress: address(raw.safeAddress, "safeAddress"),
    chainId,
    to: address(raw.to, "to"),
    value: quantity(raw.value, "value"),
    data: raw.data as Hex,
    operation: raw.operation,
    nonce: quantity(raw.nonce, "nonce"),
    safeTxGas: quantity(raw.safeTxGas, "safeTxGas", "0"),
    baseGas: quantity(raw.baseGas, "baseGas", "0"),
    gasPrice: quantity(raw.gasPrice, "gasPrice", "0"),
    gasToken: address(raw.gasToken, "gasToken", zeroAddress),
    refundReceiver: address(raw.refundReceiver, "refundReceiver", zeroAddress),
    providedSafeTxHash: provided as Hex | undefined,
    apiTxHash: raw.apiTxHash as Hex | undefined,
    signatures,
    confirmationDetails,
    confirmations: confirmationsFromDetails ?? confirmationsFromSignatures,
    confirmationsRequired: toPositiveInteger(raw.confirmationsRequired),
  };
}
