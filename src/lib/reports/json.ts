import type { RiskFinding, SafeSnapshot, SnapshotChange } from "@/lib/safe/types";

export function createJsonReport(params: {
  snapshot: SafeSnapshot;
  findings: RiskFinding[];
  changes: SnapshotChange[];
  score: number;
}): string {
  return JSON.stringify(params, bigintReplacer, 2);
}

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}
