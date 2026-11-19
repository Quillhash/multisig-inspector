import { describe, expect, it } from "vitest";
import { getMainnetChains, getTestnetChains } from "../chains/chains";
import { MAINNET_NAMES, TESTNET_NAMES } from "./networks";

describe("SEO network names", () => {
  it("match the chain registry", () => {
    expect([...MAINNET_NAMES]).toEqual(getMainnetChains().map((chain) => chain.name));
    expect([...TESTNET_NAMES]).toEqual(getTestnetChains().map((chain) => chain.name));
  });
});
