import { describe, expect, it } from "vitest";
import { concatHex, encodeFunctionData, getAddress, maxUint256, padHex, toHex } from "viem";
import { getKnownSafeComponents } from "../safeRegistry";
import { analyzeTransaction } from "./transactionXray";
import { normalizeSafeTx } from "./normalizeSafeTx";
import { parseSafeTxJson } from "./parseSafeTxJson";
import { createXRayJson, createXRayMarkdown } from "./export";

const SAFE = getAddress("0x1111111111111111111111111111111111111111");
const TARGET = getAddress("0x2222222222222222222222222222222222222222");
const OTHER = getAddress("0x3333333333333333333333333333333333333333");

function input(overrides: Record<string, unknown> = {}) {
  return normalizeSafeTx({
    source: "manual",
    safeAddress: SAFE,
    chainId: 1,
    to: TARGET,
    value: "0",
    data: "0x",
    operation: 0,
    nonce: "7",
    ...overrides,
  });
}

describe("Transaction X-Ray core", () => {
  it("normalizes defaults and JSON aliases", () => {
    const parsed = parseSafeTxJson(
      JSON.stringify({ safe: SAFE, chainId: 1, to: TARGET, value: 0, data: "0x", operation: 0, nonce: 7 }),
    );
    expect(parsed).toMatchObject({
      safeAddress: SAFE,
      source: "json",
      nonce: "7",
      safeTxGas: "0",
      gasToken: "0x0000000000000000000000000000000000000000",
    });
  });

  it("uses the selected network when pasted JSON omits chainId", () => {
    const parsed = parseSafeTxJson(JSON.stringify({ safe: SAFE, to: TARGET, value: "0", data: "0x", operation: 0, nonce: 1 }), 137);
    expect(parsed.chainId).toBe(137);
  });

  it("decodes an AccessControl grantRole call instead of Unknown contract call", () => {
    const data = encodeFunctionData({
      abi: [{ type: "function", name: "grantRole", inputs: [{ type: "bytes32" }, { type: "address" }] }],
      functionName: "grantRole",
      args: [`0x${"0".repeat(64)}` as `0x${string}`, OTHER],
    });
    const result = analyzeTransaction(input({ to: TARGET, data }));
    expect(result.actions[0]).toMatchObject({
      type: "access_control",
      title: "Access control: grant role",
    });
    expect(result.actions[0].plainEnglish).toContain("Grant role DEFAULT_ADMIN_ROLE");
    expect(result.actions[0].plainEnglish).toContain(OTHER);
  });

  it("decodes a native transfer as low risk", () => {
    const result = analyzeTransaction(input({ value: "1000000000000000000" }));
    expect(result.actions[0]).toMatchObject({
      type: "eth_transfer",
      amountRaw: "1000000000000000000",
      amountFormatted: "1 ETH",
      plainEnglish: `Transfer 1 ETH to ${TARGET}.`,
    });
    expect(result.riskLevel).toBe("low");
  });

  it("decodes ERC20 transfer and unlimited approval", () => {
    const transfer = analyzeTransaction(input({
      data: encodeFunctionData({
        abi: [{ type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }],
        functionName: "transfer",
        args: [OTHER, 1_000_000n],
      }),
    }));
    expect(transfer.actions[0]).toMatchObject({ type: "erc20_transfer", addressesInvolved: [OTHER], amountRaw: "1000000" });
    expect(transfer.riskLevel).toBe("low");

    const enrichedTransfer = analyzeTransaction(transfer.input, {
      limitations: [],
      tokenMetadata: { [TARGET.toLowerCase()]: { decimals: 6, symbol: "USDC", name: "USD Coin" } },
      assetBalances: { tokens: { [TARGET.toLowerCase()]: "2000000" } },
    });
    expect(enrichedTransfer.actions[0]).toMatchObject({
      amountFormatted: "1 USDC",
      plainEnglish: `Transfer 1 USDC to ${OTHER}.`,
      tokenName: "USD Coin",
      tokenExplorerUrl: `https://etherscan.io/token/${TARGET}`,
    });
    expect(enrichedTransfer.changes.balances).toEqual([expect.objectContaining({ asset: "USD Coin (USDC)", beforeFormatted: "2 USDC", afterFormatted: "1 USDC" })]);

    const approval = analyzeTransaction(input({
      data: encodeFunctionData({
        abi: [{ type: "function", name: "approve", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }],
        functionName: "approve",
        args: [OTHER, maxUint256],
      }),
    }));
    expect(approval.riskLevel).toBe("high");
    expect(approval.findings).toEqual(expect.arrayContaining([expect.objectContaining({ incidentPattern: "allowance-risk" })]));
  });

  it("formats transferFrom with source, recipient, and capped token decimals", () => {
    const data = encodeFunctionData({
      abi: [{ type: "function", name: "transferFrom", inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }],
      functionName: "transferFrom",
      args: [SAFE, OTHER, 1_234_567_891_234_567_890n],
    });
    const result = analyzeTransaction(input({ data }), {
      limitations: [],
      tokenMetadata: { [TARGET.toLowerCase()]: { decimals: 18, symbol: "TKN" } },
    });
    expect(result.actions[0]).toMatchObject({
      amountFormatted: "1.23456789… TKN",
      plainEnglish: `Transfer 1.23456789… TKN from ${SAFE} to ${OTHER}.`,
    });
    expect(result.actions[0].technicalDetails).toContain("raw: 1234567891234567890");
  });

  it("uses explicit raw-unit fallback wording when token metadata is unavailable", () => {
    const data = encodeFunctionData({
      abi: [{ type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }],
      functionName: "transfer",
      args: [OTHER, 1_000_000n],
    });
    const result = analyzeTransaction(input({ data }));
    expect(result.actions[0].plainEnglish).toBe(`Transfer 1000000 raw units of token ${TARGET} to ${OTHER}.`);
  });

  it("projects the Safe native balance before and after a transfer", () => {
    const result = analyzeTransaction(input({ value: "1000000000000000000" }), {
      limitations: [],
      assetBalances: { native: "5000000000000000000", tokens: {} },
    });
    expect(result.changes.balances).toEqual([{
      asset: "ETH",
      beforeRaw: "5000000000000000000",
      afterRaw: "4000000000000000000",
      beforeFormatted: "5 ETH",
      afterFormatted: "4 ETH",
    }]);
    expect(createXRayMarkdown(result)).toContain("- ETH balance: 5 ETH -> 4 ETH");
  });

  it("does not present an impossible negative token balance as a projection", () => {
    const token = TARGET.toLowerCase();
    const result = analyzeTransaction(
      input(),
      {
        limitations: [],
        tokenMetadata: { [token]: { decimals: 18, symbol: "ARB", name: "Arbitrum" } },
        assetBalances: { tokens: { [token]: "0" } },
      },
      {
        provider: "goplus",
        status: "success",
        balanceDeltas: [{
          asset: "Arbitrum (ARB)",
          tokenAddress: TARGET,
          deltaRaw: "-2100000000000000000000000",
          deltaFormatted: "-2100000 ARB",
        }],
      },
    );

    expect(result.changes.balances).toEqual([
      expect.objectContaining({
        beforeRaw: "0",
        afterRaw: "unknown",
        beforeFormatted: "Reported current balance: 0 ARB",
        afterFormatted: "Projection unavailable: reported outflow exceeds that balance by 2100000 ARB",
      }),
    ]);
  });

  it("flags Safe control changes and projects What Changes", () => {
    const addOwner = encodeFunctionData({
      abi: [{ type: "function", name: "addOwnerWithThreshold", inputs: [{ type: "address", name: "owner" }, { type: "uint256", name: "threshold" }] }],
      functionName: "addOwnerWithThreshold",
      args: [OTHER, 1n],
    });
    const result = analyzeTransaction(input({ to: SAFE, data: addOwner }), {
      safeVersion: "1.4.1",
      currentConfig: { owners: [TARGET], threshold: 2, modules: [], guard: null, fallbackHandler: null },
      limitations: [],
    });
    expect(result.actions[0].type).toBe("safe_admin");
    expect(result.riskLevel).toBe("critical");
    expect(result.changes.owners.added).toContain(OTHER);
    expect(result.changes.threshold).toEqual({ before: 2, after: 1 });
  });

  it("treats a materially lowered threshold as critical", () => {
    const data = encodeFunctionData({
      abi: [{ type: "function", name: "changeThreshold", inputs: [{ type: "uint256", name: "threshold" }] }],
      functionName: "changeThreshold",
      args: [2n],
    });
    const result = analyzeTransaction(input({ to: SAFE, data }), {
      safeVersion: "1.4.1",
      currentConfig: { owners: [SAFE, TARGET, OTHER], threshold: 5, modules: [], guard: null, fallbackHandler: null },
      limitations: [],
    });
    expect(result.riskLevel).toBe("critical");
    expect(result.findings.some((finding) => finding.title === "Threshold materially lowered")).toBe(true);
  });

  it("never downgrades delegatecall or a supported hash mismatch", () => {
    const delegatecall = analyzeTransaction(input({ operation: 1 }));
    expect(delegatecall.riskLevel).toBe("critical");
    expect(delegatecall.findings).toEqual(expect.arrayContaining([expect.objectContaining({ incidentPattern: "delegatecall-risk" })]));

    const mismatch = analyzeTransaction(input({ providedSafeTxHash: `0x${"00".repeat(32)}` }), {
      safeVersion: "1.4.1",
      limitations: [],
    });
    expect(mismatch.hashCheck.status).toBe("mismatch");
    expect(mismatch.riskLevel).toBe("critical");
  });

  it("marks unsupported hash versions without creating a mismatch", () => {
    const result = analyzeTransaction(input({ providedSafeTxHash: `0x${"00".repeat(32)}` }), {
      safeVersion: "0.0.2",
      limitations: [],
    });
    expect(result.hashCheck.status).toBe("unsupported");
    expect(result.findings.some((finding) => finding.incidentPattern === "api-integrity-risk")).toBe(false);
  });

  it("reports not provided when there is no imported hash", () => {
    expect(analyzeTransaction(input(), { safeVersion: "1.2.0", limitations: [] }).hashCheck.status).toBe("not_provided");
  });

  it("preserves raw fields in Markdown and JSON exports", () => {
    const result = analyzeTransaction(input({ data: "0x12345678" }));
    const markdown = createXRayMarkdown(result);
    const json = JSON.parse(createXRayJson(result));
    expect(markdown).toContain("## What Changes?");
    expect(markdown).toContain("0x12345678");
    expect(markdown).toContain("- Guard: No changes");
    expect(markdown).toContain("- Fallback handler: No changes");
    expect(markdown).toContain("## Findings");
    expect(markdown).toContain("## Decoded Actions");
    expect(json.input).toMatchObject({ to: TARGET, data: "0x12345678", operation: 0, nonce: "7" });
  });

  it("recursively decodes a known MultiSend transaction", () => {
    const multiSend = getKnownSafeComponents().find((component) => component.chainId === 1 && component.label.startsWith("MultiSend v"));
    expect(multiSend).toBeDefined();
    const transferData = encodeFunctionData({
      abi: [{ type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }],
      functionName: "transfer",
      args: [OTHER, 5n],
    });
    const packed = concatHex(["0x00", TARGET, padHex(toHex(0n), { size: 32 }), padHex(toHex((transferData.length - 2) / 2), { size: 32 }), transferData]);
    const data = encodeFunctionData({ abi: [{ type: "function", name: "multiSend", inputs: [{ name: "transactions", type: "bytes" }] }], functionName: "multiSend", args: [packed] });
    const result = analyzeTransaction(input({ to: multiSend!.address, data }));
    expect(result.actions[0]).toMatchObject({ type: "multi_send" });
    expect(result.actions[0].children?.[0]).toMatchObject({ type: "erc20_transfer", amountRaw: "5" });
  });

  it("keeps critical evidence inside MultiSend critical", () => {
    const multiSend = getKnownSafeComponents().find((component) => component.chainId === 1 && component.label.startsWith("MultiSend v"))!;
    const packed = concatHex(["0x01", TARGET, padHex(toHex(0n), { size: 32 }), padHex(toHex(0n), { size: 32 })]);
    const data = encodeFunctionData({ abi: [{ type: "function", name: "multiSend", inputs: [{ name: "transactions", type: "bytes" }] }], functionName: "multiSend", args: [packed] });
    expect(analyzeTransaction(input({ to: multiSend.address, data })).riskLevel).toBe("critical");
  });

  it("keeps a partial decode and finding when the MultiSend action limit is reached", () => {
    const multiSend = getKnownSafeComponents().find((component) => component.chainId === 1 && component.label.startsWith("MultiSend v"))!;
    const entry = concatHex(["0x00", TARGET, padHex(toHex(0n), { size: 32 }), padHex(toHex(0n), { size: 32 })]);
    const data = encodeFunctionData({ abi: [{ type: "function", name: "multiSend", inputs: [{ name: "transactions", type: "bytes" }] }], functionName: "multiSend", args: [concatHex(Array.from({ length: 51 }, () => entry))] });
    const result = analyzeTransaction(input({ to: multiSend.address, data }));
    expect(result.riskLevel).toBe("medium");
    expect(result.findings.some((finding) => finding.plainEnglish.includes("50-action"))).toBe(true);
    expect(result.actions[0].children?.length).toBe(51);
  });


});
