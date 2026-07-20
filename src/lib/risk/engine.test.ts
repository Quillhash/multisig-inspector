import { describe, expect, it } from "vitest";
import type { SafeSnapshot } from "@/lib/safe/types";
import {
  calculateSecurityScore,
  evaluateChangeRisk,
  evaluateSafeRisk,
  selectPrimaryFindings,
} from "./engine";

const baseSnapshot: SafeSnapshot = {
  safeAddress: "0x000000000000000000000000000000000000dEaD",
  chainId: 1,
  blockNumber: BigInt(100),
  timestamp: "2026-06-05T00:00:00.000Z",
  owners: [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333",
  ],
  threshold: 2,
  nonce: BigInt(10),
  modules: [],
  guard: "0x4444444444444444444444444444444444444444",
  fallbackHandler: "0x5555555555555555555555555555555555555555",
  singleton: "0x6666666666666666666666666666666666666666",
  version: "1.4.1",
  abiReadable: true,
  classifications: {
    singleton: {
      address: "0x6666666666666666666666666666666666666666",
      label: "Safe singleton",
      status: "known",
    },
    fallbackHandler: {
      address: "0x5555555555555555555555555555555555555555",
      label: "Safe fallback handler",
      status: "known",
    },
    guard: {
      address: "0x4444444444444444444444444444444444444444",
      label: "Known guard",
      status: "known",
    },
    modules: [],
  },
};

describe("evaluateSafeRisk", () => {
  it("flags a one-owner approval threshold as critical with incident context", () => {
    const findings = evaluateSafeRisk({ ...baseSnapshot, threshold: 1 });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "threshold-one",
          severity: "critical",
          category: "ownership",
          confidence: "high",
          userExplanation: expect.stringContaining("one owner"),
          technicalExplanation: expect.stringContaining("threshold"),
          relatedIncident: expect.objectContaining({ id: "ronin" }),
          evidence: { threshold: 1, owners: 3 },
        }),
      ]),
    );
  });

  it("flags low threshold ratios as high severity", () => {
    const findings = evaluateSafeRisk({
      ...baseSnapshot,
      owners: [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333",
        "0x4444444444444444444444444444444444444444",
        "0x5555555555555555555555555555555555555555",
        "0x6666666666666666666666666666666666666666",
        "0x7777777777777777777777777777777777777777",
      ],
      threshold: 2,
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "low-threshold-ratio",
          severity: "high",
          category: "ownership",
          relatedIncident: expect.objectContaining({ id: "harmony" }),
        }),
      ]),
    );
  });

  it("flags too few owners as medium severity", () => {
    const findings = evaluateSafeRisk({
      ...baseSnapshot,
      owners: [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
      ],
      threshold: 2,
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "too-few-owners",
          severity: "medium",
          category: "ownership",
        }),
      ]),
    );
  });

  it("flags unknown modules and unknown singleton classifications", () => {
    const findings = evaluateSafeRisk({
      ...baseSnapshot,
      modules: ["0x7777777777777777777777777777777777777777"],
      classifications: {
        ...baseSnapshot.classifications!,
        singleton: {
          address: baseSnapshot.singleton,
          label: "Unknown singleton",
          status: "unknown",
        },
        modules: [
          {
            address: "0x7777777777777777777777777777777777777777",
            label: "Unknown module",
            status: "unknown",
          },
        ],
      },
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "unknown-singleton",
          category: "component",
          relatedIncident: expect.objectContaining({ id: "bybit" }),
        }),
        expect.objectContaining({
          id: "unknown-module",
          category: "component",
        }),
      ]),
    );
  });

  it("does not flag known SafeL2 singleton classifications", () => {
    const findings = evaluateSafeRisk({
      ...baseSnapshot,
      singleton: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
      classifications: {
        ...baseSnapshot.classifications!,
        singleton: {
          address: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
          label: "SafeL2 Singleton v1.4.1",
          status: "known",
        },
      },
    });

    expect(findings.map((finding) => finding.id)).not.toContain(
      "unknown-singleton",
    );
  });

  it("adds a static scan limitation as an educational info finding", () => {
    const findings = evaluateSafeRisk(baseSnapshot);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "static-scan-limitation",
          severity: "info",
          category: "limitation",
          relatedIncident: expect.objectContaining({ id: "radiant" }),
        }),
      ]),
    );
    expect(
      findings.find((finding) => finding.id === "static-scan-limitation")
        ?.recommendation,
    ).toBe(
      "Use this scanner to review the Safe's current setup. It does not inspect pending transactions or verify what signers see before approval.",
    );
  });

  it("flags a compromised Safe (ABI unreadable, unknown singleton) as critical", () => {
    const findings = evaluateSafeRisk({
      ...baseSnapshot,
      owners: null,
      threshold: null,
      nonce: null,
      abiReadable: false,
      singleton: "0x5CB835c5a41fF41b6db0B3c99323aD16bFE84CCB",
      classifications: {
        ...baseSnapshot.classifications!,
        singleton: {
          address: "0x5CB835c5a41fF41b6db0B3c99323aD16bFE84CCB",
          label: "Unknown singleton",
          status: "unknown",
        },
      },
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "config-unreadable",
          severity: "critical",
          category: "component",
        }),
        expect.objectContaining({
          id: "unknown-singleton",
          severity: "critical",
        }),
      ]),
    );
    expect(
      findings.find((finding) => finding.id === "threshold-one"),
    ).toBeUndefined();
  });
});

describe("evaluateChangeRisk", () => {
  it("converts critical snapshot changes into incident-aware findings", () => {
    const findings = evaluateChangeRisk([
      {
        type: "owner_added",
        severity: "critical",
        title: "Owner added",
        before: ["0x1111111111111111111111111111111111111111"],
        after: "0x2222222222222222222222222222222222222222",
      },
      {
        type: "threshold_changed",
        severity: "critical",
        title: "Threshold changed",
        before: 3,
        after: 1,
      },
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "change-owner-added",
          category: "change",
          severity: "critical",
        }),
        expect.objectContaining({
          id: "change-threshold-lowered",
          category: "change",
          severity: "critical",
          relatedIncident: expect.objectContaining({ id: "ronin" }),
        }),
      ]),
    );
  });
});

describe("calculateSecurityScore", () => {
  it("deducts more points for critical findings than medium findings", () => {
    expect(
      calculateSecurityScore([
        {
          id: "critical",
          severity: "critical",
          category: "component",
          confidence: "high",
          title: "Critical",
          explanation: "Critical",
          userExplanation: "Critical",
          technicalExplanation: "Critical",
          recommendation: "Fix it",
        },
      ]),
    ).toBeLessThan(
      calculateSecurityScore([
        {
          id: "medium",
          severity: "medium",
          category: "ownership",
          confidence: "medium",
          title: "Medium",
          explanation: "Medium",
          userExplanation: "Medium",
          technicalExplanation: "Medium",
          recommendation: "Review it",
        },
      ]),
    );
  });
});

describe("selectPrimaryFindings", () => {
  it("returns only the top two non-info findings by severity", () => {
    const findings = evaluateSafeRisk({
      ...baseSnapshot,
      threshold: 1,
      classifications: {
        ...baseSnapshot.classifications!,
        singleton: {
          address: baseSnapshot.singleton,
          label: "Unknown singleton",
          status: "unknown",
        },
      },
    });

    const primary = selectPrimaryFindings(findings, 2);

    expect(primary).toHaveLength(2);
    expect(primary.every((finding) => finding.severity !== "info")).toBe(true);
    expect(primary.map((finding) => finding.severity)).toEqual([
      "critical",
      "critical",
    ]);
  });
});
