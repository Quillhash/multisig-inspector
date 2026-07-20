import { hashTypedData, type Hex } from "viem";
import type { SafeTxHashCheck, SafeTxInput } from "./types";

function cleanVersion(version?: string): string | undefined {
  if (!version) return undefined;
  // Safe L2 singletons report versions like "1.3.0+L2".
  return version.split("+")[0]?.trim();
}

function parseVersion(version: string): { major: number; minor: number; patch: number } | undefined {
  const clean = cleanVersion(version);
  if (!clean) return undefined;
  const [major, minor, patch] = clean.split(".").map(Number);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) return undefined;
  return { major, minor, patch };
}

type HashDomain = "modern" | "legacy";

function hashVersion(version?: string): HashDomain | undefined {
  const parsed = parseVersion(version ?? "");
  if (!parsed) return undefined;
  const { major, minor } = parsed;
  if (major < 1) return undefined;
  if (major > 1 || (major === 1 && minor >= 3)) return "modern";
  return "legacy";
}

function hashVersionSupported(version?: string): boolean {
  const v = hashVersion(version);
  return v === "modern" || v === "legacy";
}

function buildMessage(input: SafeTxInput, baseGasName: "baseGas" | "dataGas"): Record<string, unknown> {
  return {
    to: input.to,
    value: BigInt(input.value),
    data: input.data,
    operation: input.operation,
    safeTxGas: BigInt(input.safeTxGas),
    [baseGasName]: BigInt(input.baseGas),
    gasPrice: BigInt(input.gasPrice),
    gasToken: input.gasToken,
    refundReceiver: input.refundReceiver,
    nonce: BigInt(input.nonce),
  };
}

function buildTypes(baseGasName: "baseGas" | "dataGas") {
  return {
    SafeTx: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: baseGasName, type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
  };
}

function recomputeSafeTxHash(input: SafeTxInput, version: string): Hex {
  const domain = hashVersion(version) === "modern"
    ? { chainId: input.chainId, verifyingContract: input.safeAddress }
    : { verifyingContract: input.safeAddress };

  return hashTypedData({
    domain,
    primaryType: "SafeTx",
    types: buildTypes("baseGas"),
    message: buildMessage(input, "baseGas"),
  }) as Hex;
}

export function computeSafeTxHash(input: SafeTxInput, safeVersion?: string): SafeTxHashCheck {
  const providedSafeTxHash = input.providedSafeTxHash ?? input.apiTxHash;

  if (!providedSafeTxHash && !safeVersion) return { status: "not_provided" };
  if (!safeVersion || !hashVersionSupported(safeVersion)) {
    if (!providedSafeTxHash) return { status: "not_provided" };
    return { providedSafeTxHash, status: "unsupported" };
  }

  const recomputedSafeTxHash = recomputeSafeTxHash(input, safeVersion);

  if (!providedSafeTxHash) return { recomputedSafeTxHash, status: "not_provided" };
  const matches = recomputedSafeTxHash.toLowerCase() === providedSafeTxHash.toLowerCase();
  return { recomputedSafeTxHash, providedSafeTxHash, matches, status: matches ? "match" : "mismatch" };
}
