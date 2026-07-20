import { describe, expect, it } from "vitest";
import type { SafeSnapshot } from "@/lib/safe/types";
import { compareSnapshots } from "./compare";

const previous: SafeSnapshot = {
  safeAddress: "0x000000000000000000000000000000000000dEaD",
  chainId: 1,
  blockNumber: BigInt(100),
  timestamp: "2026-06-05T00:00:00.000Z",
  owners: ["0x1111111111111111111111111111111111111111"],
  threshold: 1,
  nonce: BigInt(1),
  modules: [],
  guard: "0x2222222222222222222222222222222222222222",
  fallbackHandler: "0x3333333333333333333333333333333333333333",
  singleton: "0x4444444444444444444444444444444444444444",
  abiReadable: true,
};

describe("compareSnapshots", () => {
  it("detects owner, threshold, module, guard, handler, and singleton changes", () => {
    const changes = compareSnapshots(previous, {
      ...previous,
      blockNumber: BigInt(200),
      owners: [
        "0x1111111111111111111111111111111111111111",
        "0x5555555555555555555555555555555555555555",
      ],
      threshold: 2,
      modules: ["0x6666666666666666666666666666666666666666"],
      guard: null,
      fallbackHandler: "0x7777777777777777777777777777777777777777",
      singleton: "0x8888888888888888888888888888888888888888",
    });

    expect(changes.map((change) => change.type)).toEqual([
      "owner_added",
      "threshold_changed",
      "module_added",
      "guard_changed",
      "fallback_handler_changed",
      "singleton_changed",
    ]);
  });

  it("returns no changes for the first scan", () => {
    expect(compareSnapshots(null, previous)).toEqual([]);
  });
});
