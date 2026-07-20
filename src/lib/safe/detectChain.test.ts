import { describe, expect, it, vi } from "vitest";
import { detectSafeChain, detectSafeChains } from "./detectChain";

describe("detectSafeChain", () => {
  it("returns the first chain that looks like a Safe (code + non-zero singleton)", async () => {
    const probe = vi.fn(async (chainId: number) => {
      if (chainId === 137) return { hasCode: true, singleton: "0xabc" as const };
      return { hasCode: false, singleton: null };
    });

    const result = await detectSafeChain([1, 137, 42161], probe);
    expect(result).toBe(137);
  });

  it("falls back to the first chain where the address has any code", async () => {
    const probe = vi.fn(async (chainId: number) => {
      if (chainId === 42161) return { hasCode: true, singleton: null };
      return { hasCode: false, singleton: null };
    });

    const result = await detectSafeChain([1, 137, 42161], probe);
    expect(result).toBe(42161);
  });

  it("returns null when no chain has code at the address", async () => {
    const probe = vi.fn(async () => ({ hasCode: false, singleton: null }));
    const result = await detectSafeChain([1, 137], probe);
    expect(result).toBeNull();
  });

  it("tolerates a probe that rejects for one chain", async () => {
    const probe = vi.fn(async (chainId: number) => {
      if (chainId === 1) throw new Error("rpc down");
      if (chainId === 137) return { hasCode: true, singleton: "0xabc" as const };
      return { hasCode: false, singleton: null };
    });

    const result = await detectSafeChain([1, 137], probe);
    expect(result).toBe(137);
  });

  it("returns every chain where the address is a Safe", async () => {
    const probe = vi.fn(async (chainId: number) => {
      if (chainId === 1 || chainId === 8453) {
        return { hasCode: true, singleton: "0xabc" as const };
      }
      return { hasCode: false, singleton: null };
    });

    const result = await detectSafeChains([1, 137, 8453], probe);

    expect(result).toEqual([1, 8453]);
  });
});
