import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { getBrowserRpcUrls, getSupportedChain } from "./chains";

export function createRpcClient(chainId: number): PublicClient {
  const chain = getSupportedChain(chainId);
  const rpcUrls = getBrowserRpcUrls(chainId);

  return createPublicClient({
    chain,
    transport: fallback(rpcUrls.map((url) => http(url))),
  });
}
