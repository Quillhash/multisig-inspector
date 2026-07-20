import { describe, expect, it, vi } from "vitest";
import { concatHex, encodeFunctionData, getAddress, maxUint256, padHex, toHex, type Hex } from "viem";
import { getKnownSafeComponents } from "../safeRegistry";
import { safeAdminAbi } from "./abis";
import { fetchSafeTransaction } from "./fetchSafeTxFromApi";
import { normalizeSafeTx } from "./normalizeSafeTx";
import { analyzeTransaction } from "./transactionXray";

const SAFE = getAddress("0x1111111111111111111111111111111111111111");
const TOKEN = getAddress("0x2222222222222222222222222222222222222222");
const OTHER = getAddress("0x3333333333333333333333333333333333333333");
const SENTINEL = getAddress("0x0000000000000000000000000000000000000001");

function input(overrides: Record<string, unknown> = {}) {
  return normalizeSafeTx({ source: "manual", safeAddress: SAFE, chainId: 1, to: TOKEN, value: "0", data: "0x", operation: 0, nonce: "1", ...overrides });
}

function admin(functionName: "addOwnerWithThreshold" | "removeOwner" | "changeThreshold" | "enableModule" | "setGuard" | "setFallbackHandler", args: readonly unknown[]) {
  return encodeFunctionData({ abi: safeAdminAbi, functionName, args } as never);
}

const config = { owners: [TOKEN, OTHER], threshold: 2, modules: [] as typeof TOKEN[], guard: null, fallbackHandler: null };

describe("Transaction X-Ray final test matrix", () => {
  it("ERC20 transfer", () => {
    const data = encodeFunctionData({ abi: [{ type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }], functionName: "transfer", args: [OTHER, 100n] });
    expect(analyzeTransaction(input({ data })).actions[0]).toMatchObject({ type: "erc20_transfer", amountRaw: "100", addressesInvolved: [OTHER] });
  });

  it("ERC20 unlimited approve", () => {
    const data = encodeFunctionData({ abi: [{ type: "function", name: "approve", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }], functionName: "approve", args: [OTHER, maxUint256] });
    const result = analyzeTransaction(input({ data }));
    expect(result.riskLevel).toBe("high");
    expect(result.findings.some((finding) => finding.title === "Unlimited token approval")).toBe(true);
  });

  it("ETH transfer", () => {
    expect(analyzeTransaction(input({ value: "1000000000000000000" })).actions[0]).toMatchObject({ type: "eth_transfer", amountFormatted: "1 ETH" });
  });

  it("Add owner", () => {
    const result = analyzeTransaction(input({ to: SAFE, data: admin("addOwnerWithThreshold", [SAFE, 2n]) }), { currentConfig: config, limitations: [] });
    expect(result.changes.owners.added).toContain(SAFE);
  });

  it("Remove owner", () => {
    const result = analyzeTransaction(input({ to: SAFE, data: admin("removeOwner", [SENTINEL, OTHER, 1n]) }), { currentConfig: config, limitations: [] });
    expect(result.changes.owners.removed).toContain(OTHER);
  });

  it("Lower threshold to 1", () => {
    const result = analyzeTransaction(input({ to: SAFE, data: admin("changeThreshold", [1n]) }), { currentConfig: config, limitations: [] });
    expect(result.changes.threshold).toEqual({ before: 2, after: 1 });
    expect(result.riskLevel).toBe("critical");
  });

  it("Enable module", () => {
    const result = analyzeTransaction(input({ to: SAFE, data: admin("enableModule", [OTHER]) }), { currentConfig: config, limitations: [] });
    expect(result.changes.modules.added).toContain(OTHER);
    expect(result.riskLevel).toBe("critical");
  });

  it("Set guard", () => {
    const result = analyzeTransaction(input({ to: SAFE, data: admin("setGuard", [OTHER]) }), { currentConfig: config, limitations: [] });
    expect(result.changes.guard).toEqual({ before: null, after: OTHER });
  });

  it("Set fallback handler", () => {
    const result = analyzeTransaction(input({ to: SAFE, data: admin("setFallbackHandler", [OTHER]) }), { currentConfig: config, limitations: [] });
    expect(result.changes.fallbackHandler).toEqual({ before: null, after: OTHER });
  });

  it("Delegatecall", () => {
    const result = analyzeTransaction(input({ operation: 1 }));
    expect(result.actions[0].type).toBe("delegatecall");
    expect(result.riskLevel).toBe("critical");
  });

  it("MultiSend with mixed actions", () => {
    const multiSend = getKnownSafeComponents().find((component) => component.chainId === 1 && component.label.startsWith("MultiSend v"))!;
    const eth = pack(0, OTHER, 1n, "0x");
    const moduleData = admin("enableModule", [OTHER]);
    const moduleCall = pack(0, SAFE, 0n, moduleData);
    const data = encodeFunctionData({ abi: [{ type: "function", name: "multiSend", inputs: [{ type: "bytes", name: "transactions" }] }], functionName: "multiSend", args: [concatHex([eth, moduleCall])] });
    const result = analyzeTransaction(input({ to: multiSend.address, data }));
    expect(result.actions[0].children?.map((action) => action.type)).toEqual(["eth_transfer", "safe_admin"]);
    expect(result.riskLevel).toBe("critical");
  });

  it("Hash mismatch", () => {
    const result = analyzeTransaction(input({ providedSafeTxHash: `0x${"00".repeat(32)}` }), { safeVersion: "1.4.1", limitations: [] });
    expect(result.hashCheck.status).toBe("mismatch");
    expect(result.riskLevel).toBe("critical");
  });

  it("Unsupported hash", () => {
    const result = analyzeTransaction(input({ providedSafeTxHash: `0x${"00".repeat(32)}` }), { safeVersion: "0.0.2", limitations: [] });
    expect(result.hashCheck.status).toBe("unsupported");
  });

  it("Safe API failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    await expect(fetchSafeTransaction(1, `0x${"00".repeat(32)}`, fetcher)).rejects.toThrow("paste the transaction JSON");
  });

  it("Malformed calldata", () => {
    const result = analyzeTransaction(input({ data: "0x12345678" }));
    expect(result.actions[0]).toMatchObject({ type: "unknown_contract_call" });
    expect(result.riskLevel).toBe("medium");
  });
});

function pack(operation: 0 | 1, to: typeof OTHER, value: bigint, data: Hex): Hex {
  return concatHex([toHex(operation, { size: 1 }), to, padHex(toHex(value), { size: 32 }), padHex(toHex((data.length - 2) / 2), { size: 32 }), data]);
}
