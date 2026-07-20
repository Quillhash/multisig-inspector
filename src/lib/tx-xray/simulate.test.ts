import { describe, expect, it, vi } from "vitest";
import { normalizeSafeTx } from "./normalizeSafeTx";
import { simulateTransaction } from "./simulate";

const safe = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";

describe("simulateTransaction", () => {
  it("normalizes successful GoPlus gas and Safe token deltas", async () => {
    const input = normalizeSafeTx({
      source: "json",
      safeAddress: safe,
      chainId: 1,
      to: token,
      value: "0",
      data: "0x",
      operation: 0,
      nonce: "1",
    });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: 1,
      message: "ok",
      result: {
        is_simulated: true,
        is_revert: false,
        used_gas: "44932",
        flagged: false,
        erc20_balance_changes: [{
          address: safe,
          erc20_change: [{ token_address: token, change: "-0xf4240" }],
        }],
      },
    }), { status: 200 }));

    const result = await simulateTransaction(input, {
      limitations: [],
      tokenMetadata: { [token]: { decimals: 6, symbol: "USDC", name: "USD Coin" } },
      assetBalances: { tokens: { [token]: "2000000" } },
    }, fetcher as typeof fetch);

    expect(result).toMatchObject({
      provider: "goplus",
      status: "success",
      gasUsed: "44932",
      flagged: false,
      balanceDeltas: [{
        asset: "USD Coin (USDC)",
        tokenAddress: token,
        deltaRaw: "-1000000",
        deltaFormatted: "-1 USDC",
      }],
    });
    expect(fetcher).toHaveBeenCalledWith("/api/xray/simulate", expect.objectContaining({ method: "POST" }));
  });

  it("preserves a GoPlus revert as an advisory result", async () => {
    const input = normalizeSafeTx({ source: "manual", safeAddress: safe, chainId: 1, to: token, value: "0", data: "0x", operation: 0, nonce: "1" });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: 1,
      result: { is_simulated: true, is_revert: true, revert_reason: "ERC20: transfer amount exceeds balance" },
    }), { status: 200 }));

    const result = await simulateTransaction(input, { limitations: [] }, fetcher as typeof fetch);
    expect(result.status).toBe("reverted");
    expect(result.revertReason).toContain("exceeds balance");
  });
});
