import { describe, expect, it } from "vitest";
import { parseSafeUrl } from "./parseSafeUrl";

describe("parseSafeUrl", () => {
  it("parses a Safe queue URL for manual pending selection", () => {
    expect(parseSafeUrl("https://app.safe.global/transactions/queue?safe=eth:0x1111111111111111111111111111111111111111")).toEqual({
      chainId: 1,
      safeAddress: "0x1111111111111111111111111111111111111111",
      kind: "queue",
    });
  });

  it("extracts a transaction hash when present", () => {
    const hash = `0x${"ab".repeat(32)}`;
    expect(parseSafeUrl(`https://app.safe.global/transactions/tx?safe=matic:0x1111111111111111111111111111111111111111&id=multisig_1_${hash}`)).toMatchObject({
      chainId: 137,
      transactionId: hash,
      kind: "transaction",
    });
  });

  it("rejects non-Safe and unsupported URLs", () => {
    expect(() => parseSafeUrl("https://example.com/?safe=eth:0x1111111111111111111111111111111111111111")).toThrow("Safe URL");
    expect(() => parseSafeUrl("https://app.safe.global/home?safe=unknown:0x1111111111111111111111111111111111111111")).toThrow("network");
  });

  it("parses a Safe Transaction Service API URL for pending transactions", () => {
    expect(parseSafeUrl("https://api.safe.global/tx-service/eth/api/v1/safes/0x3B5f13799f71c10E6b06844A842Aa953e7494F69/multisig-transactions/")).toEqual({
      chainId: 1,
      safeAddress: "0x3B5f13799f71c10E6b06844A842Aa953e7494F69",
      kind: "queue",
    });
  });

  it("parses a Safe Transaction Service API URL for a specific transaction", () => {
    const hash = `0x${"ab".repeat(32)}`;
    expect(parseSafeUrl(`https://api.safe.global/tx-service/eth/api/v1/multisig-transactions/${hash}/`)).toMatchObject({
      chainId: 1,
      transactionId: hash,
      kind: "transaction",
    });
  });
});
