import { describe, expect, it } from "vitest";
import { normalizeSafeAddress, parseSafeAddressInput } from "./address";

describe("normalizeSafeAddress", () => {
  it("returns a checksummed address for valid user input", () => {
    expect(
      normalizeSafeAddress("0x000000000000000000000000000000000000dead"),
    ).toBe("0x000000000000000000000000000000000000dEaD");
  });

  it("rejects malformed addresses with a plain error", () => {
    expect(() => normalizeSafeAddress("safe.eth")).toThrow(
      "Enter a valid EVM address.",
    );
  });
});

describe("parseSafeAddressInput", () => {
  it("accepts a bare checksummed/lowercase address with no chain hint", () => {
    expect(parseSafeAddressInput("0x000000000000000000000000000000000000dead")).toEqual({
      address: "0x000000000000000000000000000000000000dEaD",
      chainId: undefined,
    });
  });

  it("accepts an EIP-3770 prefixed address and resolves the chain", () => {
    expect(parseSafeAddressInput("eth:0x000000000000000000000000000000000000dead")).toEqual({
      address: "0x000000000000000000000000000000000000dEaD",
      chainId: 1,
    });
    expect(parseSafeAddressInput("matic:0x000000000000000000000000000000000000dead").chainId).toBe(137);
  });

  it("extracts the safe address from a pasted app.safe.global URL", () => {
    expect(
      parseSafeAddressInput(
        "https://app.safe.global/transactions/queue?safe=eth:0x000000000000000000000000000000000000dead",
      ).chainId,
    ).toBe(1);
  });

  it("rejects an unknown EIP-3770 prefix", () => {
    expect(() => parseSafeAddressInput("lol:0x000000000000000000000000000000000000dead")).toThrow(
      /unsupported network/i,
    );
  });
});
