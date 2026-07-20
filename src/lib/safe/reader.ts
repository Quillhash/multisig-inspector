import type { PublicClient } from "viem";
import { findKnownSafeComponentAnyChain } from "../safeRegistry";
import { safeAbi } from "./abi";
import {
  addressFromStorageValue,
  FALLBACK_HANDLER_STORAGE_SLOT,
  GUARD_STORAGE_SLOT,
  SENTINEL_ADDRESS,
  SINGLETON_STORAGE_SLOT,
} from "./slots";
import type { Address } from "./types";

const MODULE_PAGE_SIZE = BigInt(50);

export type RawSafeConfig = {
  owners: Address[] | null;
  threshold: number | null;
  nonce: bigint | null;
  modules: Address[] | null;
  guard: Address | null;
  fallbackHandler: Address | null;
  singleton: Address | null;
  version?: string;
  blockNumber: bigint;
  abiReadable: boolean;
};

export class NotAContractError extends Error {
  constructor() {
    super("address is not a contract");
    this.name = "NotAContractError";
  }
}

export class SafeImplementationAddressError extends Error {
  readonly componentLabel: string;
  readonly chainIds: number[];
  constructor(componentLabel: string, chainIds: number[]) {
    super(
      `This address is the ${componentLabel} implementation contract, not a deployed Safe proxy.`,
    );
    this.name = "SafeImplementationAddressError";
    this.componentLabel = componentLabel;
    this.chainIds = chainIds;
  }
}

type ReadResult<T> = { ok: true; value: T } | { ok: false };

function ok<T>(value: T): ReadResult<T> {
  return { ok: true, value };
}

function failed(): ReadResult<never> {
  return { ok: false };
}

async function safeRead<T>(
  operation: () => Promise<T>,
): Promise<ReadResult<T>> {
  try {
    return ok(await operation());
  } catch {
    return failed();
  }
}

export async function readSafeConfig(
  client: PublicClient,
  safeAddress: Address,
): Promise<RawSafeConfig> {
  const [guardValue, fallbackHandlerValue, singletonValue, blockNumber, codeResult] =
    await Promise.all([
      client.getStorageAt({ address: safeAddress, slot: GUARD_STORAGE_SLOT }),
      client.getStorageAt({
        address: safeAddress,
        slot: FALLBACK_HANDLER_STORAGE_SLOT,
      }),
      client.getStorageAt({ address: safeAddress, slot: SINGLETON_STORAGE_SLOT }),
      client.getBlockNumber(),
      safeRead(() => client.getCode({ address: safeAddress })),
    ]);

  const safeHasCode = codeResult.ok ? codeResult.value !== "0x" : false;
  if (!safeHasCode) {
    throw new NotAContractError();
  }

  const knownImpl = findKnownSafeComponentAnyChain(safeAddress);
  if (knownImpl && knownImpl.component.type !== "module") {
    throw new SafeImplementationAddressError(
      knownImpl.component.label,
      knownImpl.chainIds,
    );
  }

  const [ownersRes, thresholdRes, nonceRes, modulesRes, version] =
    await Promise.all([
      safeRead(() =>
        client.readContract({
          address: safeAddress,
          abi: safeAbi,
          functionName: "getOwners",
        }),
      ),
      safeRead(() =>
        client.readContract({
          address: safeAddress,
          abi: safeAbi,
          functionName: "getThreshold",
        }),
      ),
      safeRead(() =>
        client.readContract({
          address: safeAddress,
          abi: safeAbi,
          functionName: "nonce",
        }),
      ),
      safeRead(() => readModules(client, safeAddress)),
      readVersion(client, safeAddress),
    ]);

  const owners = ownersRes.ok ? (ownersRes.value as Address[]) : null;
  const threshold = thresholdRes.ok ? Number(thresholdRes.value) : null;
  const nonce = nonceRes.ok ? (nonceRes.value as bigint) : null;
  const modules = modulesRes.ok ? (modulesRes.value as Address[]) : null;
  const abiReadable =
    owners !== null && threshold !== null && nonce !== null && modules !== null;

  if (!abiReadable && !singletonValue) {
    throw new NotAContractError();
  }

  return {
    owners,
    threshold,
    nonce,
    modules,
    guard: guardValue ? addressFromStorageValue(guardValue) : null,
    fallbackHandler: fallbackHandlerValue
      ? addressFromStorageValue(fallbackHandlerValue)
      : null,
    singleton: singletonValue ? addressFromStorageValue(singletonValue) : null,
    version,
    blockNumber,
    abiReadable,
  };
}

async function readModules(
  client: PublicClient,
  safeAddress: Address,
): Promise<Address[]> {
  const modules: Address[] = [];
  let cursor: Address = SENTINEL_ADDRESS;

  for (let page = 0; page < 20; page += 1) {
    const [pageModules, next] = await client.readContract({
      address: safeAddress,
      abi: safeAbi,
      functionName: "getModulesPaginated",
      args: [cursor, MODULE_PAGE_SIZE],
    });

    modules.push(...(pageModules as Address[]));

    if (next.toLowerCase() === SENTINEL_ADDRESS.toLowerCase()) {
      return modules;
    }

    cursor = next as Address;
  }

  return modules;
}

async function readVersion(
  client: PublicClient,
  safeAddress: Address,
): Promise<string | undefined> {
  try {
    return await client.readContract({
      address: safeAddress,
      abi: safeAbi,
      functionName: "VERSION",
    });
  } catch {
    return undefined;
  }
}
