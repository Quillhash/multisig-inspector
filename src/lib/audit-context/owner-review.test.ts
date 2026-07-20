import { describe, expect, it } from "vitest";
import type { Address } from "@/lib/safe/types";
import {
  createOwnerReviewSummary,
  evaluateOwnerReviewRisk,
  type OwnerReviewAnswer,
} from "./owner-review";

const owners: Address[] = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
];

describe("evaluateOwnerReviewRisk", () => {
  it("does not add risk when the user recognizes all owners", () => {
    expect(evaluateOwnerReviewRisk({ answer: "all_expected", owners })).toEqual(
      [],
    );
  });

  it("adds a critical finding when the user reports an unexpected owner", () => {
    const findings = evaluateOwnerReviewRisk({
      answer: "unexpected_owner",
      owners,
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "owner-review-unexpected",
        severity: "critical",
        category: "ownership",
        confidence: "high",
        title: "User reported an unexpected owner",
        evidence: { answer: "unexpected_owner", owners },
      }),
    ]);
  });

  it("adds a manual-review finding when the user is not sure", () => {
    const findings = evaluateOwnerReviewRisk({
      answer: "not_sure",
      owners,
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "owner-review-not-sure",
        severity: "medium",
        category: "ownership",
        confidence: "medium",
      }),
    ]);
  });
});

describe("createOwnerReviewSummary", () => {
  it.each<OwnerReviewAnswer>([
    "all_expected",
    "unexpected_owner",
    "not_sure",
  ])("includes owners and answer in the report summary for %s", (answer) => {
    const summary = createOwnerReviewSummary({ answer, owners });

    expect(summary.answer).toBe(answer);
    expect(summary.ownerCount).toBe(2);
    expect(summary.owners).toEqual(owners);
  });
});
