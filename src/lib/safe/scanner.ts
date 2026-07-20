import type { PublicClient } from "viem";
import { classifySafeComponents } from "./registry";
import { readSafeConfig } from "./reader";
import type { Address, ClassifiedAddress, SafeSnapshot } from "./types";

export async function scanSafe(params: {
  client: PublicClient;
  safeAddress: Address;
  chainId: number;
}): Promise<SafeSnapshot> {
  const rawConfig = await readSafeConfig(params.client, params.safeAddress);
  const classifications = await validateUnknownComponentCode(
    params.client,
    classifySafeComponents({
      chainId: params.chainId,
      singleton: rawConfig.singleton,
      fallbackHandler: rawConfig.fallbackHandler,
      guard: rawConfig.guard,
      modules: rawConfig.modules ?? [],
    }),
  );

  return {
    safeAddress: params.safeAddress,
    chainId: params.chainId,
    blockNumber: rawConfig.blockNumber,
    timestamp: new Date().toISOString(),
    owners: rawConfig.owners,
    threshold: rawConfig.threshold,
    nonce: rawConfig.nonce,
    modules: rawConfig.modules ?? [],
    guard: rawConfig.guard,
    fallbackHandler: rawConfig.fallbackHandler,
    singleton: rawConfig.singleton,
    version: rawConfig.version,
    abiReadable: rawConfig.abiReadable,
    classifications,
  };
}

async function validateUnknownComponentCode(
  client: PublicClient,
  classifications: NonNullable<SafeSnapshot["classifications"]>,
): Promise<NonNullable<SafeSnapshot["classifications"]>> {
  const [singleton, fallbackHandler, guard, modules] = await Promise.all([
    validateComponentCode(client, classifications.singleton),
    validateComponentCode(client, classifications.fallbackHandler),
    validateComponentCode(client, classifications.guard),
    Promise.all(
      classifications.modules.map((moduleClassification) =>
        validateComponentCode(client, moduleClassification),
      ),
    ),
  ]);

  return {
    singleton,
    fallbackHandler,
    guard,
    modules,
  };
}

async function validateComponentCode(
  client: PublicClient,
  classification: ClassifiedAddress,
): Promise<ClassifiedAddress> {
  if (classification.status !== "unknown" || !classification.address) {
    return classification;
  }

  try {
    const code = await client.getCode({ address: classification.address });

    return {
      ...classification,
      hasCode: Boolean(code && code !== "0x"),
    };
  } catch {
    return classification;
  }
}
