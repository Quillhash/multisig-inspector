import { getAddress, isAddress, keccak256, pad, slice, toBytes, type Hex } from "viem";
import type { Address } from "./types";

export const SENTINEL_ADDRESS =
  "0x0000000000000000000000000000000000000001" as const;

export const SINGLETON_STORAGE_SLOT = "0x0" as const;
export const GUARD_STORAGE_SLOT = keccak256(toBytes("guard_manager.guard.address"));
export const FALLBACK_HANDLER_STORAGE_SLOT = keccak256(
  toBytes("fallback_manager.handler.address"),
);

export function addressFromStorageValue(value: Hex): Address | null {
  const normalized = pad(value, { size: 32 });
  const candidate = `0x${slice(normalized, 12).replace(/^0x/, "")}`;

  if (
    candidate.toLowerCase() === "0x0000000000000000000000000000000000000000"
  ) {
    return null;
  }

  if (!isAddress(candidate)) {
    return null;
  }

  return getAddress(candidate) as Address;
}
