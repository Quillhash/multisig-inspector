// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionXRayApp } from "./transaction-xray-app";
import { TransactionResult } from "./transaction-result";
import { analyzeTransaction } from "../../lib/tx-xray/transactionXray";
import { normalizeSafeTx } from "../../lib/tx-xray/normalizeSafeTx";
import { encodeFunctionData } from "viem";

describe("TransactionXRayApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    cleanup();
  });
  it("supports JSON analysis and answer-first result hierarchy", async () => {
    render(<TransactionXRayApp enrich={async () => ({ limitations: [] })} />);
    fireEvent.click(screen.getByRole("tab", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("Safe transaction JSON"), { target: { value: JSON.stringify({ safe: "0x1111111111111111111111111111111111111111", chainId: 1, to: "0x2222222222222222222222222222222222222222", value: "1000000000000000000", data: "0x", operation: 0, nonce: 1 }) } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze transaction" }));
    expect(await screen.findByText("Transaction Integrity")).toBeTruthy();
    expect(screen.getByText("HASH: ✕ Unverified")).toBeTruthy();
    const headings = screen.getAllByRole("heading").map((node) => node.textContent);
    expect(headings.indexOf("Risk Level")).toBeLessThan(headings.indexOf("In Simple Terms"));
    expect(screen.getByText("What Changes?")).toBeTruthy();
    expect(screen.getByText("Fallback handler")).toBeTruthy();
    expect(screen.getAllByText("Transfer 1 ETH to 0x2222222222222222222222222222222222222222.").length).toBeGreaterThan(0);
    expect(screen.getByText("1 ETH (raw: 1000000000000000000)")).toBeTruthy();
  });

  it("shows Safe Address trust copy", () => {
    render(<TransactionXRayApp />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Safe Address", "JSON", "Manual Input"]);
    fireEvent.click(screen.getByRole("tab", { name: "Safe Address" }));
    expect(screen.getByText(/convenience importer/i)).toBeTruthy();
  });

  it("shows the GoPlus simulation toggle with supported-chain note when no chain is selected", () => {
    render(<TransactionXRayApp />);
    const toggle = screen.getByRole("switch", { name: /External Simulation by GoPlus/i });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    // Toggle is disabled (no supported chain selected yet).
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    // User is told which chains are supported.
    expect(screen.getByText(/Ethereum, BNB Chain, and Base only/i)).toBeTruthy();
  });

  it("labels locally matched hashes as verified", () => {
    const base = normalizeSafeTx({ source: "json", safeAddress: "0x1111111111111111111111111111111111111111", chainId: 1, to: "0x2222222222222222222222222222222222222222", value: "0", data: "0x", operation: 0, nonce: "1" });
    const local = analyzeTransaction(base, { safeVersion: "1.4.1", limitations: [] }).hashCheck.recomputedSafeTxHash!;
    const result = analyzeTransaction({ ...base, providedSafeTxHash: local }, { safeVersion: "1.4.1", limitations: [] });
    render(<TransactionResult result={result} />);
    expect(screen.getByText("HASH: ✓ Verified")).toBeTruthy();
    expect(screen.getByText("Locally recomputed hash matches the provided Safe transaction hash.")).toBeTruthy();
    expect(screen.getByText(/Transaction hash \(locally recomputed EIP-712\):/)).toBeTruthy();
  });

  it("links token names to the network block explorer and shows projected balances", () => {
    const token = "0x2222222222222222222222222222222222222222";
    const base = normalizeSafeTx({ source: "json", safeAddress: "0x1111111111111111111111111111111111111111", chainId: 1, to: token, value: "0", data: encodeFunctionData({ abi: [{ type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }], functionName: "transfer", args: ["0x3333333333333333333333333333333333333333", 1_000_000n] }), operation: 0, nonce: "1" });
    const result = analyzeTransaction(base, { limitations: [], tokenMetadata: { [token.toLowerCase()]: { decimals: 6, symbol: "USDC", name: "USD Coin" } }, assetBalances: { tokens: { [token.toLowerCase()]: "2000000" } } });
    render(<TransactionResult result={result} />);
    expect(screen.getByRole("link", { name: "USD Coin (USDC)" }).getAttribute("href")).toBe(`https://etherscan.io/token/${token}`);
    expect(screen.getByText("2 USDC → 1 USDC")).toBeTruthy();
  });

});
