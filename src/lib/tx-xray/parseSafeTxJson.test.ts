import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { parseMultiSendItems } from "./decodeMultiSend";
import { parseSafeTxJson } from "./parseSafeTxJson";

const SAFE = "0x1111111111111111111111111111111111111111";
const TARGET = "0x2222222222222222222222222222222222222222";

describe("parseSafeTxJson", () => {
  it("keeps accepting flat Safe transaction JSON", () => {
    const result = parseSafeTxJson(JSON.stringify({
      safe: SAFE,
      chainId: 1,
      to: TARGET,
      value: "0",
      data: "0x",
      operation: 0,
      nonce: 4,
    }));

    expect(result).toMatchObject({ safeAddress: SAFE, chainId: 1, to: TARGET, nonce: "4" });
  });

  it("imports a single-call Transaction Builder export", () => {
    const result = parseSafeTxJson(JSON.stringify(batch([
      { to: TARGET, value: "12", data: "0x1234" },
    ])), { nonce: "7" });

    expect(result).toMatchObject({
      safeAddress: SAFE,
      chainId: 11155111,
      to: TARGET,
      value: "12",
      data: "0x1234",
      operation: 0,
      nonce: "7",
    });
  });

  it("encodes a multi-call Transaction Builder export as MultiSendCallOnly", () => {
    const result = parseSafeTxJson(JSON.stringify(batch([
      { to: TARGET, value: "0", data: "0x1234" },
      { to: SAFE, value: "5", data: "0x" },
    ])), { nonce: "8" });
    const decoded = decodeFunctionData({
      abi: [{ type: "function", name: "multiSend", inputs: [{ name: "transactions", type: "bytes" }] }],
      data: result.data,
    });
    const packed = decoded.args?.[0];
    if (typeof packed !== "string" || !packed.startsWith("0x")) {
      throw new Error("Expected encoded MultiSend transactions.");
    }
    const children = parseMultiSendItems(packed as `0x${string}`);

    expect(result.operation).toBe(1);
    expect(result.nonce).toBe("8");
    expect(children).toEqual([
      { operation: 0, to: TARGET, value: "0", data: "0x1234" },
      { operation: 0, to: SAFE, value: "5", data: "0x" },
    ]);
  });

  it("encodes contract method fields when raw data is absent", () => {
    const result = parseSafeTxJson(JSON.stringify(batch([{
      to: TARGET,
      value: "0",
      contractMethod: {
        name: "approve",
        payable: false,
        inputs: [
          { name: "spender", type: "address", internalType: "address" },
          { name: "amount", type: "uint256", internalType: "uint256" },
        ],
      },
      contractInputsValues: { spender: SAFE, amount: "10" },
    }])), { nonce: "9" });

    expect(result.data).toMatch(/^0x095ea7b3/);
  });

  it("requires a nonce because Transaction Builder exports omit it", () => {
    expect(() => parseSafeTxJson(JSON.stringify(batch([
      { to: TARGET, value: "0", data: "0x" },
    ])))).toThrow(/Safe nonce is required/);
  });
});

function batch(transactions: unknown[]) {
  return {
    version: "1.0",
    chainId: "11155111",
    createdAt: 1,
    meta: { name: "Verification batch", createdFromSafeAddress: SAFE },
    transactions,
  };
}
