import { describe, expect, it } from "vitest";
import type { StoredSafeSnapshot } from "./db";
import { selectLatestSnapshot } from "./db";

const baseSnapshot: StoredSafeSnapshot = {
  id: 1,
  snapshotKey: "11155111:0x000000000000000000000000000000000000dead",
  safeAddress: "0x000000000000000000000000000000000000dEaD",
  chainId: 11155111,
  blockNumber: BigInt(100),
  timestamp: "2026-06-05T10:00:00.000Z",
  owners: [],
  threshold: 0,
  nonce: BigInt(0),
  modules: [],
  guard: null,
  fallbackHandler: null,
  singleton: null,
  abiReadable: true,
};

describe("selectLatestSnapshot", () => {
  it("returns the newest snapshot by timestamp", () => {
    const latest = {
      ...baseSnapshot,
      id: 2,
      timestamp: "2026-06-05T11:00:00.000Z",
      blockNumber: BigInt(200),
    };

    expect(selectLatestSnapshot([baseSnapshot, latest])).toBe(latest);
  });

  it("uses the newest id when timestamps match", () => {
    const latest = {
      ...baseSnapshot,
      id: 3,
      blockNumber: BigInt(300),
    };

    expect(selectLatestSnapshot([baseSnapshot, latest])).toBe(latest);
  });
});
