import { describe, expect, it } from "vitest";
import { computeSafeTxHash } from "./computeSafeTxHash";
import { normalizeSafeTx } from "./normalizeSafeTx";

const ZERO = "0x0000000000000000000000000000000000000000";

describe("computeSafeTxHash official transaction vectors", () => {
  it("matches a real Safe v1.3.0 mainnet transaction", () => {
    // Official Safe Transaction Service record, executed in Ethereum block 25,350,770:
    // https://api.safe.global/tx-service/eth/api/v1/multisig-transactions/0x71a5ddef1bcf8f673831f55eaf97345d1eaf3b65b7f2c7724804e87e693055f5/
    const input = normalizeSafeTx({
      source: "safe-api",
      chainId: 1,
      safeAddress: "0x849D52316331967b6fF1198e5E32A0eB168D039d",
      to: "0xc6132FAF04627c8d05d6E759FAbB331Ef2D8F8fD",
      value: "0",
      data: "0xaad3ec96000000000000000000000000849d52316331967b6ff1198e5e32a0eb168d039d0000000000000000000000000000000000000000000000000000000000000019",
      operation: 0,
      safeTxGas: "0",
      baseGas: "0",
      gasPrice: "0",
      gasToken: ZERO,
      refundReceiver: ZERO,
      nonce: "2822",
      providedSafeTxHash: "0x71a5ddef1bcf8f673831f55eaf97345d1eaf3b65b7f2c7724804e87e693055f5",
    });

    expect(computeSafeTxHash(input, "1.3.0")).toMatchObject({
      status: "match",
      matches: true,
      recomputedSafeTxHash: "0x71a5ddef1bcf8f673831f55eaf97345d1eaf3b65b7f2c7724804e87e693055f5",
    });
  });

  it("matches a real Safe v1.4.1 Base transaction", () => {
    // Official Safe Transaction Service record, executed in Base block 47,657,652:
    // https://api.safe.global/tx-service/base/api/v1/multisig-transactions/0x4c227008c493b18b2a33e09986efe06a5b2602cb22517d41e17138fe8ca80e0e/
    const input = normalizeSafeTx({
      source: "safe-api",
      chainId: 8453,
      safeAddress: "0xDF97fE356a1852a860de39Ef23105c99E00226f9",
      to: "0xD10be77aD727ce32C85809a2ae8Ff4d86EbC068D",
      value: "100000000000000",
      data: "0x",
      operation: 0,
      safeTxGas: "0",
      baseGas: "0",
      gasPrice: "0",
      gasToken: ZERO,
      refundReceiver: ZERO,
      nonce: "0",
      providedSafeTxHash: "0x4c227008c493b18b2a33e09986efe06a5b2602cb22517d41e17138fe8ca80e0e",
    });

    expect(computeSafeTxHash(input, "1.4.1")).toMatchObject({
      status: "match",
      matches: true,
      recomputedSafeTxHash: "0x4c227008c493b18b2a33e09986efe06a5b2602cb22517d41e17138fe8ca80e0e",
    });
  });

  it("matches a real Safe v1.1.1 mainnet transaction (legacy domain, no chainId)", () => {
    // Official Safe Transaction Service record for the Bybit cold wallet, executed in Ethereum block 21,895,238:
    // https://api.safe.global/tx-service/eth/api/v1/multisig-transactions/0xb3476d061aeb8fc1d605a873c483a2402d88a68a9cdd1a8b47655dd55ba004f8/
    const input = normalizeSafeTx({
      source: "safe-api",
      chainId: 1,
      safeAddress: "0x1Db92e2EeBC8E0c075a02BeA49a2935BcD2dFCF4",
      to: "0x96221423681A6d52E184D440a8eFCEbB105C7242",
      value: "0",
      data: "0xa9059cbb000000000000000000000000bdd077f651ebe7f7b3ce16fe5f2b025be29695160000000000000000000000000000000000000000000000000000000000000000",
      operation: 1,
      safeTxGas: "45746",
      baseGas: "0",
      gasPrice: "0",
      gasToken: ZERO,
      refundReceiver: ZERO,
      nonce: "71",
      providedSafeTxHash: "0xb3476d061aeb8fc1d605a873c483a2402d88a68a9cdd1a8b47655dd55ba004f8",
    });

    expect(computeSafeTxHash(input, "1.1.1")).toMatchObject({
      status: "match",
      matches: true,
      recomputedSafeTxHash: "0xb3476d061aeb8fc1d605a873c483a2402d88a68a9cdd1a8b47655dd55ba004f8",
    });
  });
});
