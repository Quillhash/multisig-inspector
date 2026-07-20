import type { Address, RiskFinding } from "@/lib/safe/types";
import { incidentReferences } from "../risk/engine";

export type OwnerReviewAnswer =
  | "all_expected"
  | "unexpected_owner"
  | "not_sure";

export type OwnerReviewContext = {
  answer: OwnerReviewAnswer;
  owners: Address[];
};

export type OwnerReviewSummary = {
  answer: OwnerReviewAnswer;
  ownerCount: number;
  owners: Address[];
  label: string;
};

export function evaluateOwnerReviewRisk(
  context: OwnerReviewContext,
): RiskFinding[] {
  if (context.answer === "all_expected") {
    return [];
  }

  if (context.answer === "unexpected_owner") {
    return [
      {
        id: "owner-review-unexpected",
        severity: "critical",
        category: "ownership",
        confidence: "high",
        title: "User reported an unexpected owner",
        explanation:
          "The person scanning this Safe reported that one or more owner addresses are not expected.",
        userExplanation:
          "One or more owner addresses were marked as unexpected. Treat this as urgent until verified.",
        technicalExplanation:
          "The on-chain owner set includes at least one address the reviewer did not recognize during owner verification.",
        recommendation:
          "Pause high-value operations and verify the owner set through governance, deployment records, and signer inventory.",
        relatedIncident: incidentReferences.ronin,
        evidence: {
          answer: context.answer,
          owners: context.owners,
        },
      },
    ];
  }

  return [
    {
      id: "owner-review-not-sure",
      severity: "medium",
      category: "ownership",
      confidence: "medium",
      title: "Owner list was not confirmed",
      explanation:
        "The person scanning this Safe was not sure whether every owner address is expected.",
      userExplanation:
        "The owner list could not be confirmed. This requires manual review before relying on the Safe posture.",
      technicalExplanation:
        "Owner verification was answered as not sure after displaying the getOwners() address list.",
      recommendation:
        "Map each owner address to a known signer and confirm whether any owner is stale, shared, or unknown.",
      evidence: {
        answer: context.answer,
        owners: context.owners,
      },
    },
  ];
}

export function createOwnerReviewSummary(
  context: OwnerReviewContext,
): OwnerReviewSummary {
  return {
    answer: context.answer,
    ownerCount: context.owners.length,
    owners: context.owners,
    label: ownerReviewLabels[context.answer],
  };
}

export const ownerReviewLabels: Record<OwnerReviewAnswer, string> = {
  all_expected: "All owners are expected",
  unexpected_owner: "Some owners look unexpected",
  not_sure: "Not sure whether every owner is expected",
};
