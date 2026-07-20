import { parseAbi, type Address, type PublicClient } from "viem";
import { createRpcClient } from "../chains/rpc";
import { readSafeConfig, type RawSafeConfig } from "../safe/reader";
import { decodeCalldata } from "./decodeCalldata";
import type { SafeTxEnrichment, SafeTxInput } from "./types";

type Dependencies = {
  createClient: (chainId: number) => PublicClient;
  readSafeConfig: (client: PublicClient, safeAddress: SafeTxInput["safeAddress"]) => Promise<RawSafeConfig>;
};

const defaults: Dependencies = { createClient: createRpcClient, readSafeConfig };
const tokenMetadataAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function balanceOf(address account) view returns (uint256)",
]);

// ERC-165 supportsInterface — used to detect ERC-721 contracts so that a
// transferFrom (selector 0x23b872dd, shared with ERC-20) can be reclassified.
const erc165Abi = parseAbi(["function supportsInterface(bytes4 interfaceId) view returns (bool)"]);
const ERC721_INTERFACE_ID = "0x80ac58cd";

export async function enrichTransaction(input: SafeTxInput, dependencies: Dependencies = defaults): Promise<SafeTxEnrichment> {
  const limitations: string[] = [];
  let client: PublicClient;
  try {
    client = dependencies.createClient(input.chainId);
  } catch {
    return { tokenMetadata: {}, assetBalances: { tokens: {} }, limitations: ["Current Safe configuration and version could not be loaded. Analysis continues without on-chain context.", "Token metadata could not be loaded. Raw token units are shown instead."] };
  }

  let safeContext: Pick<SafeTxEnrichment, "safeVersion" | "currentConfig"> = {};
  try {
    const config = await dependencies.readSafeConfig(client, input.safeAddress);
    safeContext = {
      safeVersion: config.version,
      currentConfig: {
        owners: config.owners ?? [],
        threshold: config.threshold ?? 0,
        modules: config.modules ?? [],
        guard: config.guard,
        fallbackHandler: config.fallbackHandler,
      },
    };
    if (!config.abiReadable) {
      limitations.push(
        "Safe owner set and threshold could not be read on-chain. Current-config comparison is based on best-effort storage reads.",
      );
    }
    if (!config.version) limitations.push("Safe version could not be loaded; hash verification is unsupported.");
  } catch {
    limitations.push("Current Safe configuration and version could not be loaded. Analysis continues without on-chain context.");
  }

  const tokenMetadata: NonNullable<SafeTxEnrichment["tokenMetadata"]> = {};
  const assetBalances: NonNullable<SafeTxEnrichment["assetBalances"]> = { tokens: {} };
  const erc721Contracts = new Set<string>();
  const decodedActions = decodeCalldata(input);
  if (hasNativeTransfer(decodedActions)) {
    try {
      assetBalances.native = (await client.getBalance({ address: input.safeAddress })).toString();
    } catch {
      limitations.push("Balance for the Safe's native asset could not be loaded. Balance projection is unavailable.");
    }
  }
  const tokenAddresses = collectTokenAddresses(decodedActions);
  await Promise.all(tokenAddresses.map(async (tokenAddress) => {
    const [decimalsResult, symbolResult, nameResult, balanceResult, erc721Result] = await Promise.allSettled([
      client.readContract({ address: tokenAddress, abi: tokenMetadataAbi, functionName: "decimals" }),
      client.readContract({ address: tokenAddress, abi: tokenMetadataAbi, functionName: "symbol" }),
      client.readContract({ address: tokenAddress, abi: tokenMetadataAbi, functionName: "name" }),
      client.readContract({ address: tokenAddress, abi: tokenMetadataAbi, functionName: "balanceOf", args: [input.safeAddress] }),
      client.readContract({ address: tokenAddress, abi: erc165Abi, functionName: "supportsInterface", args: [ERC721_INTERFACE_ID] }),
    ]);
    const decimals = decimalsResult.status === "fulfilled" ? decimalsResult.value : undefined;
    const symbol = symbolResult.status === "fulfilled" ? symbolResult.value : undefined;
    if (erc721Result.status === "fulfilled" && erc721Result.value === true) {
      erc721Contracts.add(tokenAddress.toLowerCase());
    }
    if (Number.isInteger(decimals) && typeof decimals === "number" && decimals >= 0 && decimals <= 255 && isValidText(symbol, 32)) {
      tokenMetadata[tokenAddress.toLowerCase()] = { decimals, symbol: symbol.trim(), ...(nameResult.status === "fulfilled" && isValidText(nameResult.value, 128) ? { name: nameResult.value.trim() } : {}) };
    } else {
      limitations.push(`Token metadata for ${tokenAddress} could not be loaded. Raw token units are shown instead.`);
    }
    if (balanceResult.status === "fulfilled" && typeof balanceResult.value === "bigint") assetBalances.tokens[tokenAddress.toLowerCase()] = balanceResult.value.toString();
    else limitations.push(`Balance for token ${tokenAddress} could not be loaded. Balance projection is unavailable.`);
  }));

  return { ...safeContext, tokenMetadata, assetBalances, ...(erc721Contracts.size ? { erc721Contracts } : {}), limitations };
}

function collectTokenAddresses(actions: ReturnType<typeof decodeCalldata>): Address[] {
  return [...new Set(actions.flatMap((action) => [
    ...(action.tokenAddress ? [action.tokenAddress] : []),
    ...collectTokenAddresses(action.children ?? []),
  ]).map((address) => address.toLowerCase()))] as Address[];
}

function isValidText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length <= maxLength && /^[\x20-\x7E]+$/.test(value.trim());
}

function hasNativeTransfer(actions: ReturnType<typeof decodeCalldata>): boolean {
  return actions.some((action) => action.type === "eth_transfer" || hasNativeTransfer(action.children ?? []));
}
