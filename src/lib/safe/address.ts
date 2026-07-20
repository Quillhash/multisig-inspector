import { getAddress, isAddress } from "viem";
import { SAFE_PREFIX_TO_CHAIN } from "../chains/safePrefixes";
import type { Address } from "./types";

export function normalizeSafeAddress(input: string): Address {
  const trimmed = input.trim();

  if (!isAddress(trimmed)) {
    throw new Error("Enter a valid EVM address.");
  }

  return getAddress(trimmed) as Address;
}

export type ParsedSafeAddressInput = {
  address: Address;
  chainId?: number;
};

export function parseSafeAddressInput(input: string): ParsedSafeAddressInput {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a valid EVM address.");

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return parseSafeUrlInput(trimmed);
  }

  const colon = trimmed.indexOf(":");
  if (colon > 0 && !trimmed.slice(0, colon).startsWith("0x")) {
    const prefix = trimmed.slice(0, colon).toLowerCase();
    const rest = trimmed.slice(colon + 1);
    const chainId = SAFE_PREFIX_TO_CHAIN[prefix];
    if (!chainId) throw new Error("The address prefix uses an unsupported network.");
    if (!isAddress(rest)) throw new Error("Enter a valid EVM address.");
    return { address: getAddress(rest) as Address, chainId };
  }

  if (!isAddress(trimmed)) throw new Error("Enter a valid EVM address.");
  return { address: getAddress(trimmed) as Address };
}

function parseSafeUrlInput(value: string): ParsedSafeAddressInput {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid EVM address or Safe URL.");
  }

  if (url.hostname === "app.safe.global") {
    const safe = url.searchParams.get("safe");
    if (!safe) throw new Error("The pasted Safe URL does not include a Safe address.");
    return parseSafeAddressInput(safe);
  }

  if (url.hostname === "api.safe.global") {
    const match = url.pathname.match(
      /^\/tx-service\/([^/]+)\/api\/v1\/safes\/(0x[a-fA-F0-9]{40})/,
    );
    if (!match) throw new Error("Could not parse the Safe API URL.");
    const chainId = SAFE_PREFIX_TO_CHAIN[match[1]];
    if (!chainId) throw new Error("The Safe API URL uses an unsupported network.");
    return { address: getAddress(match[2]) as Address, chainId };
  }

  if (url.hostname === "etherscan.io" || url.hostname.endsWith(".etherscan.io")) {
    const match = url.pathname.match(/\/address\/(0x[a-fA-F0-9]{40})/);
    if (match) return { address: getAddress(match[1]) as Address };
  }

  throw new Error("Paste a 0x address, an eth:0x… prefixed address, or a Safe URL.");
}
