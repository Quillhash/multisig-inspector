import { describe, expect, it } from "vitest";
import {
  getBrowserRpcUrls,
  getMainnetChains,
  getTestnetChains,
  getVisibleChains,
  supportedChains,
} from "./chains";

describe("supportedChains", () => {
  it("includes major production chains and Sepolia-focused testnets", () => {
    const chainIds = supportedChains.map((chain) => chain.id);

    expect(chainIds).toEqual(
      expect.arrayContaining([1, 10, 56, 100, 137, 42161, 43114, 8453]),
    );
    expect(getTestnetChains().map((chain) => chain.id)).toEqual([
      11155111, 84532,
    ]);
  });

  it("marks Sepolia and Base Sepolia as the only testnets", () => {
    const testnets = getTestnetChains();

    expect(testnets.map((chain) => chain.name)).toEqual([
      "Sepolia",
      "Base Sepolia",
    ]);
    expect(testnets.every((chain) => chain.networkType === "testnet")).toBe(
      true,
    );
  });

  it("hides testnets from the default visible chain list", () => {
    expect(getVisibleChains(false)).toEqual(getMainnetChains());
    expect(getVisibleChains(true)).toEqual(supportedChains);
  });

  it("uses explicit browser-friendly Ethereum RPC URLs instead of default Merkle endpoint", () => {
    const mainnetRpcUrls = getBrowserRpcUrls(1);

    expect(mainnetRpcUrls.length).toBeGreaterThan(0);
    expect(mainnetRpcUrls).not.toContain("https://eth.merkle.io");
    expect(mainnetRpcUrls[0]).toBe("https://ethereum-rpc.publicnode.com");
  });
});
