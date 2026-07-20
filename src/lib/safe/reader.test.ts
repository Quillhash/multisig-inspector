import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { keccak256, toBytes } from "viem";
import { readSafeConfig } from "./reader";
import { SENTINEL_ADDRESS } from "./slots";
import type { Address } from "./types";

const SAFE = "0x3B5f13799f71c10E6b06844A842Aa953e7494F69" as Address;
const ROGUE_SINGLETON =
  "0x5CB835c5a41fF41b6db0B3c99323aD16bFE84CCB" as Address;
const KNOWN_SEPOLIA_SINGLETON =
  "0x41675C099F32341bf84BFc5382aF534df5C7461a" as Address;

const GUARD_SLOT = keccak256(toBytes("guard_manager.guard.address"));
const FALLBACK_SLOT = keccak256(toBytes("fallback_manager.handler.address"));

type FakeClient = {
  readContract: ReturnType<typeof vi.fn>;
  getStorageAt: ReturnType<typeof vi.fn>;
  getCode: ReturnType<typeof vi.fn>;
  getBlockNumber: ReturnType<typeof vi.fn>;
};

function padAddress(address: string) {
  return `0x${address.slice(2).padStart(64, "0")}` as const;
}

function buildClient(overrides: Partial<FakeClient> = {}): FakeClient {
  const readContract = vi.fn();
  const getStorageAt = vi.fn();
  const getCode = vi.fn();
  const getBlockNumber = vi.fn(async () => 20_000_000n);
  readContract.mockImplementation((args: { functionName?: string; slot?: string }) => {
    if (args.functionName === "getOwners") {
      return ["0x1111111111111111111111111111111111111111" as Address];
    }
    if (args.functionName === "getThreshold") return 2n;
    if (args.functionName === "nonce") return 5n;
    if (args.functionName === "getModulesPaginated") {
      return [[], SENTINEL_ADDRESS];
    }
    if (args.functionName === "VERSION") return "1.4.1";
    throw new Error(`unexpected call ${args.functionName}`);
  });

  getStorageAt.mockImplementation(async (args: { functionName?: string; slot?: string }) => {
    if (args.slot === "0x0") return padAddress(ROGUE_SINGLETON);
    return "0x";
  });
  getCode.mockResolvedValue("0x60806040");

  return { readContract, getStorageAt, getCode, getBlockNumber, ...overrides };
}

describe("readSafeConfig — failure isolation", () => {
  it("still reads storage slots when ABI view calls revert (compromised Safe)", async () => {
    const client = buildClient({
      readContract: vi.fn(() => {
        throw new Error("execution reverted");
      }),
    });

    const config = await readSafeConfig(
      client as unknown as PublicClient,
      SAFE,
    );

    expect(config.owners).toBeNull();
    expect(config.threshold).toBeNull();
    expect(config.nonce).toBeNull();
    expect(config.modules).toBeNull();
    expect(config.abiReadable).toBe(false);
    expect(config.singleton).toBe(ROGUE_SINGLETON);
    expect(config.blockNumber).toBe(20_000_000n);
  });

  it("throws for an EOA (no contract code)", async () => {
    const client = buildClient({ getCode: vi.fn(async () => "0x") });

    await expect(
      readSafeConfig(client as unknown as PublicClient, SAFE),
    ).rejects.toThrow(/not a contract|does not look like/i);
  });

  it("throws a specific error when the address is a known Safe singleton", async () => {
    const client = buildClient();

    await expect(
      readSafeConfig(
        client as unknown as PublicClient,
        KNOWN_SEPOLIA_SINGLETON,
      ),
    ).rejects.toThrow(/implementation contract|not a deployed Safe proxy/i);
  });

  it("returns abiReadable true and populated fields for a healthy Safe", async () => {
    const client = buildClient({
      getStorageAt: vi.fn(async (args: { functionName?: string; slot?: string }) => {
        if (args.slot === "0x0") return padAddress(KNOWN_SEPOLIA_SINGLETON);
        if (args.slot === GUARD_SLOT) return "0x";
        if (args.slot === FALLBACK_SLOT) return "0x";
        return "0x";
      }),
    });

    const config = await readSafeConfig(
      client as unknown as PublicClient,
      SAFE,
    );

    expect(config.abiReadable).toBe(true);
    expect(config.owners).toEqual([
      "0x1111111111111111111111111111111111111111",
    ]);
    expect(config.threshold).toBe(2);
    expect(config.nonce).toBe(5n);
    expect(config.modules).toEqual([]);
    expect(config.singleton).toBe(KNOWN_SEPOLIA_SINGLETON);
    expect(config.guard).toBeNull();
    expect(config.fallbackHandler).toBeNull();
  });
});
