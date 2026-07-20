import { describe, expect, it, vi } from "vitest";
import { encodeFunctionData, getAddress } from "viem";
import { normalizeSafeTx } from "./normalizeSafeTx";
import { resolveCalls } from "./resolveCalldata";
import { analyzeTransaction } from "./transactionXray";

const SAFE = getAddress("0x1111111111111111111111111111111111111111");
const TARGET = getAddress("0x2222222222222222222222222222222222222222");

// A selector the offline decoder does not recognize.
const UNKNOWN_ABI = [{ type: "function", name: "foobar", inputs: [{ type: "uint256" }] }] as const;
const unknownData = encodeFunctionData({ abi: UNKNOWN_ABI, functionName: "foobar", args: [42n] });

function input() {
  return normalizeSafeTx({ source: "manual", safeAddress: SAFE, chainId: 1, to: TARGET, value: "0", data: unknownData, operation: 0, nonce: "1" });
}

function mockFetch(payload: { abi?: unknown[] | null; signature?: string | null }) {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
}

describe("resolveCalls (Layer-1 online resolution)", () => {
  it("without a resolver, an unknown selector stays Unknown contract call", () => {
    const result = analyzeTransaction(input());
    expect(result.actions[0].type).toBe("unknown_contract_call");
    expect(result.actions[0].title).toBe("Unknown contract call");
  });

  it("decodes via a resolved 4-byte signature", async () => {
    const resolver = await resolveCalls(input(), mockFetch({ signature: "foobar(uint256)" }));
    const result = analyzeTransaction(input(), undefined, undefined, resolver);
    expect(result.actions[0].type).toBe("contract_call");
    expect(result.actions[0].title).toBe("Call: foobar");
    expect(result.actions[0].plainEnglish).toContain("foobar(42)");
    expect(result.actions[0].resolutionNote).toBe("unverified-signature");
  });

  it("decodes via a resolved verified ABI", async () => {
    const resolver = await resolveCalls(input(), mockFetch({ abi: [...UNKNOWN_ABI] }));
    const result = analyzeTransaction(input(), undefined, undefined, resolver);
    expect(result.actions[0].type).toBe("contract_call");
    expect(result.actions[0].resolutionNote).toBe("verified-abi");
  });

  it("humanizes grantRoles(bytes32[], address) without dumping the array", async () => {
    const grantRolesAbi = [{ type: "function", name: "grantRoles", inputs: [{ type: "bytes32[]" }, { type: "address" }] }] as const;
    const data = encodeFunctionData({
      abi: grantRolesAbi,
      functionName: "grantRoles",
      args: [[`0x${"1".repeat(64)}`, `0x${"2".repeat(64)}`, `0x${"3".repeat(64)}`], "0x5bf3B7c14b10f16939d63Bd679264A1Aa951B4D5"],
    });
    const grantInput = normalizeSafeTx({ source: "manual", safeAddress: SAFE, chainId: 1, to: TARGET, value: "0", data, operation: 0, nonce: "1" });
    const resolver = await resolveCalls(grantInput, mockFetch({ signature: "grantRoles(bytes32[],address)" }));
    const result = analyzeTransaction(grantInput, undefined, undefined, resolver);
    expect(result.actions[0].plainEnglish).toContain("Grants 3 roles");
    expect(result.actions[0].plainEnglish).toContain("0x5bf3");
    expect(result.actions[0].plainEnglish).toContain("B4D5");
    // The full hex array must NOT appear in the plain-English summary.
    expect(result.actions[0].plainEnglish).not.toContain("0x1111111111111111111111111111111111111111111111111111111111111111");
  });

  it("falls back to Unknown when nothing resolves", async () => {
    const resolver = await resolveCalls(input(), mockFetch({ abi: null, signature: null }));
    const result = analyzeTransaction(input(), undefined, undefined, resolver);
    expect(result.actions[0].type).toBe("unknown_contract_call");
  });
});
