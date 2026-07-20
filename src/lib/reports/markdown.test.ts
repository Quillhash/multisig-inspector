import { describe, expect, it } from "vitest";
import type { RiskFinding, SafeSnapshot, SnapshotChange } from "@/lib/safe/types";
import { createMarkdownReport } from "./markdown";

describe("createMarkdownReport", () => {
  it("renders a client-readable report with score, findings, config, and changes", () => {
    const snapshot: SafeSnapshot = {
      safeAddress: "0x000000000000000000000000000000000000dEaD",
      chainId: 1,
      blockNumber: BigInt(100),
      timestamp: "2026-06-05T00:00:00.000Z",
      owners: ["0x1111111111111111111111111111111111111111"],
      threshold: 1,
      nonce: BigInt(4),
      modules: [],
      guard: null,
      fallbackHandler: null,
      singleton: "0x2222222222222222222222222222222222222222",
      abiReadable: true,
    };
    const findings: RiskFinding[] = [
      {
        id: "threshold-one",
        severity: "critical",
        category: "ownership",
        confidence: "high",
        title: "Single approval can move funds",
        explanation: "Only one owner approval is required.",
        userExplanation: "Only one owner approval is required.",
        technicalExplanation: "The Safe threshold is 1.",
        recommendation: "Increase the threshold.",
        relatedIncident: {
          id: "ronin",
          name: "Ronin bridge validator key compromise",
          year: 2022,
          pattern: "Enough keys were compromised to meet the threshold.",
          url: "https://www.halborn.com/blog/post/explained-the-ronin-hack-march-2022",
        },
      },
    ];
    const changes: SnapshotChange[] = [
      {
        type: "threshold_changed",
        severity: "critical",
        title: "Threshold changed",
        before: 2,
        after: 1,
      },
    ];

    const report = createMarkdownReport({
      snapshot,
      findings,
      changes,
      score: 60,
    });

    expect(report).toContain("# Safe Security Report");
    expect(report).toContain("Security score: 60/100");
    expect(report).toContain("Single approval can move funds");
    expect(report).toContain("Category: ownership");
    expect(report).toContain("Similar risk pattern: Ronin bridge validator key compromise");
    expect(report).toContain("Threshold changed");
    expect(report).toContain("0x000000000000000000000000000000000000dEaD");
  });
});
