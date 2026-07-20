import { describe, expect, it } from "vitest";
import { supportedChains } from "../chains/chains";
import { classifySafeComponents, safeRegistryMetadata } from "./registry";

describe("classifySafeComponents", () => {
  it("exposes transparent source metadata for the local registry", () => {
    expect(safeRegistryMetadata).toEqual(
      expect.objectContaining({
        sourceUrl: expect.stringContaining("safe-deployments"),
        generatedAt: expect.any(String),
        safeVersionsCovered: expect.arrayContaining(["1.3.0", "1.4.1"]),
      }),
    );
  });

  it("classifies official Safe v1.4.1 components as known on Sepolia", () => {
    const classifications = classifySafeComponents({
      chainId: 11155111,
      singleton: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
      fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
      guard: null,
      modules: [],
    });

    expect(classifications.singleton).toEqual(
      expect.objectContaining({
        label: "Safe Singleton v1.4.1",
        status: "known",
      }),
    );
    expect(classifications.fallbackHandler).toEqual(
      expect.objectContaining({
        label: "Compatibility Fallback Handler v1.4.1",
        status: "known",
      }),
    );
  });

  it("classifies official SafeL2 singleton variants as known", () => {
    const safeL2V141 = classifySafeComponents({
      chainId: 11155111,
      singleton: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
      fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
      guard: null,
      modules: [],
    });
    const safeL2V130 = classifySafeComponents({
      chainId: 11155111,
      singleton: "0x3E5c63644E683549055b9Be8653de26E0B4CD36E",
      fallbackHandler: "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4",
      guard: null,
      modules: [],
    });

    expect(safeL2V141.singleton).toEqual(
      expect.objectContaining({
        label: "SafeL2 Singleton v1.4.1",
        status: "known",
      }),
    );
    expect(safeL2V130.singleton).toEqual(
      expect.objectContaining({
        label: "SafeL2 Singleton v1.3.0",
        status: "known",
      }),
    );
    expect(safeL2V130.fallbackHandler).toEqual(
      expect.objectContaining({
        label: "Compatibility Fallback Handler v1.3.0",
        status: "known",
      }),
    );
  });

  it("treats no fallback handler as a known empty configuration", () => {
    const classifications = classifySafeComponents({
      chainId: 11155111,
      singleton: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
      fallbackHandler: null,
      guard: null,
      modules: [],
    });

    expect(classifications.fallbackHandler).toEqual({
      address: null,
      label: "No fallback handler",
      status: "known",
      type: "fallback_handler",
    });
  });

  it("classifies official singleton addresses independent of chain", () => {
    for (const chain of supportedChains) {
      const classifications = classifySafeComponents({
        chainId: chain.id,
        singleton: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
        fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
        guard: null,
        modules: [],
      });

      expect(classifications.singleton.status).toBe("known");
      expect(classifications.fallbackHandler.status).toBe("known");
    }
  });
});
