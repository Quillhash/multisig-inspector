import { describe, expect, it, vi } from "vitest";
import { encodeFunctionData } from "viem";
import { enrichTransaction } from "./enrichTransaction";
import { normalizeSafeTx } from "./normalizeSafeTx";

const input = normalizeSafeTx({ source: "manual", safeAddress: "0x1111111111111111111111111111111111111111", chainId: 1, to: "0x2222222222222222222222222222222222222222", value: "0", data: "0x", operation: 0, nonce: "1" });

describe("enrichTransaction", () => {
  it("returns Safe context when RPC reads succeed", async () => {
    const read = vi.fn().mockResolvedValue({ owners: [input.safeAddress], threshold: 1, nonce: 1n, modules: [], guard: null, fallbackHandler: null, singleton: null, version: "1.4.1", blockNumber: 1n, abiReadable: true });
    const result = await enrichTransaction(input, { createClient: vi.fn().mockReturnValue({}), readSafeConfig: read });
    expect(result).toMatchObject({ safeVersion: "1.4.1", currentConfig: { threshold: 1 }, limitations: [] });
  });

  it("continues with a limitation when RPC reads fail", async () => {
    const result = await enrichTransaction(input, { createClient: vi.fn().mockReturnValue({}), readSafeConfig: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(result.currentConfig).toBeUndefined();
    expect(result.limitations[0]).toContain("could not be loaded");
  });

  it("loads ERC20 decimals and symbol without trusting them as transaction evidence", async () => {
    const tokenInput = normalizeSafeTx({
      ...input,
      source: "manual",
      data: encodeFunctionData({
        abi: [{ type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }],
        functionName: "transfer",
        args: [input.safeAddress, 1_000_000n],
      }),
    });
    const client = {
      readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "decimals") return Promise.resolve(6);
        if (functionName === "symbol") return Promise.resolve("USDC");
        if (functionName === "name") return Promise.resolve("USD Coin");
        if (functionName === "balanceOf") return Promise.resolve(2_000_000n);
        return Promise.reject(new Error("unknown read"));
      }),
    };
    const result = await enrichTransaction(tokenInput, {
      createClient: vi.fn().mockReturnValue(client),
      readSafeConfig: vi.fn().mockRejectedValue(new Error("not a Safe")),
    });
    expect(result.tokenMetadata?.[input.to.toLowerCase()]).toEqual({ decimals: 6, symbol: "USDC", name: "USD Coin" });
    expect(result.assetBalances?.tokens[input.to.toLowerCase()]).toBe("2000000");
  });

  it("loads the Safe native balance for a native transfer", async () => {
    const nativeInput = normalizeSafeTx({ ...input, source: "manual", value: "1000000000000000000" });
    const result = await enrichTransaction(nativeInput, {
      createClient: vi.fn().mockReturnValue({ getBalance: vi.fn().mockResolvedValue(5_000_000_000_000_000_000n) }),
      readSafeConfig: vi.fn().mockRejectedValue(new Error("not a Safe")),
    });
    expect(result.assetBalances?.native).toBe("5000000000000000000");
  });

  it("keeps analysis available when token metadata cannot be loaded", async () => {
    const tokenInput = normalizeSafeTx({
      ...input,
      source: "manual",
      data: encodeFunctionData({
        abi: [{ type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }],
        functionName: "transfer",
        args: [input.safeAddress, 1n],
      }),
    });
    const result = await enrichTransaction(tokenInput, {
      createClient: vi.fn().mockReturnValue({ readContract: vi.fn().mockRejectedValue(new Error("offline")) }),
      readSafeConfig: vi.fn().mockRejectedValue(new Error("offline")),
    });
    expect(result.tokenMetadata).toEqual({});
    expect(result.limitations.some((item) => item.includes("Token metadata"))).toBe(true);
  });
});
