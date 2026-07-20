import { normalizeSafeTx, type RawSafeTx } from "./normalizeSafeTx";

export function parseManualInput(input: Omit<RawSafeTx, "source"> & { source?: "manual" }) {
  return normalizeSafeTx({ ...input, source: "manual" });
}
