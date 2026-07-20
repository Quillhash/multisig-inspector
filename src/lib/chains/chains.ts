import type { Chain } from "viem";
import {
  arbitrum,
  avalanche,
  base,
  baseSepolia,
  bsc,
  gnosis,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "viem/chains";

export type SupportedChain = Chain & {
  blockExplorerBaseUrl: string;
  networkType: "mainnet" | "testnet";
  browserRpcUrls?: string[];
  iconSlug: string;
};

export const supportedChains: SupportedChain[] = [
  {
    ...mainnet,
    blockExplorerBaseUrl: "https://etherscan.io",
    networkType: "mainnet",
    iconSlug: "ethereum",
    browserRpcUrls: [
      "https://ethereum-rpc.publicnode.com",
      "https://eth.drpc.org",
      "https://rpc.flashbots.net",
    ],
  },
  {
    ...polygon,
    blockExplorerBaseUrl: "https://polygonscan.com",
    networkType: "mainnet",
    iconSlug: "polygon",
    browserRpcUrls: [
      "https://polygon-rpc.publicnode.com",
      "https://polygon.drpc.org",
      "https://1rpc.io/matic",
    ],
  },
  {
    ...arbitrum,
    blockExplorerBaseUrl: "https://arbiscan.io",
    networkType: "mainnet",
    iconSlug: "arbitrum",
    browserRpcUrls: [
      "https://arbitrum-one-rpc.publicnode.com",
      "https://arbitrum.drpc.org",
      "https://1rpc.io/arb",
    ],
  },
  {
    ...optimism,
    blockExplorerBaseUrl: "https://optimistic.etherscan.io",
    networkType: "mainnet",
    iconSlug: "optimism",
    browserRpcUrls: [
      "https://optimism-rpc.publicnode.com",
      "https://optimism.drpc.org",
      "https://1rpc.io/op",
    ],
  },
  {
    ...base,
    blockExplorerBaseUrl: "https://basescan.org",
    networkType: "mainnet",
    iconSlug: "base",
    browserRpcUrls: [
      "https://base-rpc.publicnode.com",
      "https://base.drpc.org",
      "https://1rpc.io/base",
    ],
  },
  {
    ...gnosis,
    blockExplorerBaseUrl: "https://gnosisscan.io",
    networkType: "mainnet",
    iconSlug: "gnosis",
    browserRpcUrls: [
      "https://gnosis-rpc.publicnode.com",
      "https://gnosis.drpc.org",
    ],
  },
  {
    ...bsc,
    blockExplorerBaseUrl: "https://bscscan.com",
    networkType: "mainnet",
    iconSlug: "bsc",
    browserRpcUrls: [
      "https://bsc-rpc.publicnode.com",
      "https://bsc.drpc.org",
      "https://1rpc.io/bnb",
    ],
  },
  {
    ...avalanche,
    blockExplorerBaseUrl: "https://snowtrace.io",
    networkType: "mainnet",
    iconSlug: "avax",
    browserRpcUrls: [
      "https://avalanche-c-chain-rpc.publicnode.com",
      "https://avalanche.drpc.org",
    ],
  },
  {
    ...sepolia,
    blockExplorerBaseUrl: "https://sepolia.etherscan.io",
    networkType: "testnet",
    iconSlug: "ethereum",
    browserRpcUrls: [
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://sepolia.drpc.org",
    ],
  },
  {
    ...baseSepolia,
    blockExplorerBaseUrl: "https://sepolia.basescan.org",
    networkType: "testnet",
    iconSlug: "base",
    browserRpcUrls: [
      "https://base-sepolia-rpc.publicnode.com",
    ],
  },
];

export function getMainnetChains(): SupportedChain[] {
  return supportedChains.filter((chain) => chain.networkType === "mainnet");
}

export function getTestnetChains(): SupportedChain[] {
  return supportedChains.filter((chain) => chain.networkType === "testnet");
}

export function getVisibleChains(showTestnets: boolean): SupportedChain[] {
  if (showTestnets) {
    return supportedChains;
  }

  return getMainnetChains();
}

const CHAIN_ICON_FILES: Record<SupportedChain["iconSlug"], string> = {
  ethereum: "ethereum.svg",
  polygon: "polygon.svg",
  arbitrum: "arbitrum.svg",
  optimism: "optimism.svg",
  base: "base.svg",
  gnosis: "gnosis.svg",
  bsc: "bsc.svg",
  avax: "avalanche.svg",
};

export function getChainIconUrl(chain: SupportedChain): string {
  return `/chains/${CHAIN_ICON_FILES[chain.iconSlug]}`;
}

export function getSupportedChain(chainId: number): SupportedChain {
  const chain = supportedChains.find((candidate) => candidate.id === chainId);

  if (!chain) {
    throw new Error("Unsupported network.");
  }

  return chain;
}

export function getBrowserRpcUrls(chainId: number): string[] {
  const chain = getSupportedChain(chainId);
  return [...(chain.browserRpcUrls ?? chain.rpcUrls.default.http)];
}
