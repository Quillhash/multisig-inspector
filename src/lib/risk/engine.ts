import type {
  IncidentReference,
  RiskCategory,
  RiskConfidence,
  RiskFinding,
  RiskSeverity,
  SafeSnapshot,
  SnapshotChange,
} from "@/lib/safe/types";

const scorePenalty: Record<RiskSeverity, number> = {
  critical: 30,
  high: 18,
  medium: 10,
  low: 4,
  info: 0,
};

const severityRank: Record<RiskSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export const incidentReferences: Record<IncidentReference["id"], IncidentReference> = {
  bybit: {
    id: "bybit",
    name: "Bybit Safe signing incident",
    year: 2025,
    pattern:
      "Signers approved what looked like a normal Safe flow while malicious transaction logic changed control.",
    url: "https://www.nccgroup.com/research/in-depth-technical-analysis-of-the-bybit-hack/",
  },
  radiant: {
    id: "radiant",
    name: "Radiant Capital compromised signer machines",
    year: 2024,
    pattern:
      "Multiple signer devices were compromised and used to approve malicious upgrade activity.",
    url: "https://www.halborn.com/blog/post/explained-the-radiant-capital-hack-october-2024",
  },
  wazirx: {
    id: "wazirx",
    name: "WazirX multisig signing mismatch",
    year: 2024,
    pattern:
      "A custody multisig flow exposed the risk of signers reviewing one intent while execution differed.",
    url: "https://www.halborn.com/blog/post/explained-the-wazirx-hack-july-2024",
  },
  ronin: {
    id: "ronin",
    name: "Ronin bridge validator key compromise",
    year: 2022,
    pattern:
      "Attackers compromised enough signing keys to meet the multisig approval threshold.",
    url: "https://www.halborn.com/blog/post/explained-the-ronin-hack-march-2022",
  },
  harmony: {
    id: "harmony",
    name: "Harmony Horizon low-threshold multisig compromise",
    year: 2022,
    pattern:
      "A low multisig threshold meant a small number of compromised keys could authorize bridge withdrawals.",
    url: "https://techcrunch.com/2022/06/24/harmony-blockchain-crypto-hack/",
  },
};

export function evaluateSafeRisk(snapshot: SafeSnapshot): RiskFinding[] {
  const findings: RiskFinding[] = [];
  const ownerCount = snapshot.owners?.length ?? 0;
  const threshold = snapshot.threshold;
  const thresholdRatio =
    ownerCount > 0 && threshold !== null ? threshold / ownerCount : 0;

  if (threshold !== null && threshold === 1) {
    findings.push(
      createFinding({
        id: "threshold-one",
        severity: "critical",
        category: "ownership",
        confidence: "high",
        title: "Single approval can move funds",
        userExplanation:
          "Only one owner is needed to approve Safe actions. If that one key is compromised, funds can move.",
        technicalExplanation:
          "The Safe threshold is 1, so any configured owner can satisfy the approval policy alone.",
        recommendation:
          "Increase the threshold after confirming the owner set and operating process.",
        evidence: { threshold, owners: ownerCount },
        relatedIncident: incidentReferences.ronin,
      }),
    );
  }

  if (threshold !== null && threshold > ownerCount) {
    findings.push(
      createFinding({
        id: "threshold-impossible",
        severity: "critical",
        category: "ownership",
        confidence: "high",
        title: "Threshold is higher than owner count",
        userExplanation:
          "The Safe appears to require more approvals than there are owners, which can block operations.",
        technicalExplanation:
          "The threshold value is greater than the length of the owner array returned by getOwners().",
        recommendation:
          "Review the Safe configuration immediately before relying on this Safe for operations.",
        evidence: { threshold, owners: ownerCount },
      }),
    );
  }

  if (
    ownerCount > 0 &&
    threshold !== null &&
    threshold > 1 &&
    thresholdRatio <= 0.34
  ) {
    findings.push(
      createFinding({
        id: "low-threshold-ratio",
        severity: "high",
        category: "ownership",
        confidence: "high",
        title: "Small minority of owners can approve actions",
        userExplanation:
          "A small minority of owners can approve Safe actions. This increases damage if a few keys are compromised.",
        technicalExplanation:
          `The approval ratio is ${threshold}/${ownerCount}, which is at or below the 34% risk threshold.`,
        recommendation:
          "Consider raising the threshold or reviewing whether the current owner set is too large.",
        evidence: {
          threshold,
          owners: ownerCount,
          ratio: Number(thresholdRatio.toFixed(2)),
        },
        relatedIncident: incidentReferences.harmony,
      }),
    );
  }

  if (
    ownerCount > 0 &&
    ownerCount < 3 &&
    threshold !== null &&
    threshold !== 1
  ) {
    findings.push(
      createFinding({
        id: "too-few-owners",
        severity: "medium",
        category: "ownership",
        confidence: "medium",
        title: "Very small owner set",
        userExplanation:
          "This Safe has fewer than three owners, which gives little room for key loss or signer compromise.",
        technicalExplanation:
          `The Safe returned ${ownerCount} owners. Treasury Safes commonly need more independent owners for resilience.`,
        recommendation:
          "Add independent owners and set a threshold that balances compromise resistance with recovery.",
        evidence: { threshold, owners: ownerCount },
      }),
    );
  }

  if (!snapshot.abiReadable) {
    findings.push(
      createFinding({
        id: "config-unreadable",
        severity: "critical",
        category: "component",
        confidence: "high",
        title: "Safe configuration could not be read from the contract",
        userExplanation:
          "The Safe did not respond to standard owner and threshold calls. This is a strong signal that the Safe's implementation (mastercopy) has been replaced with a rogue or custom contract — the exact pattern used in the WazirX compromise.",
        technicalExplanation:
          "Calls to getOwners(), getThreshold(), and nonce() reverted or returned no data, so the owner set, threshold, and nonce cannot be verified from the proxy alone. The singleton/mastercopy storage slot still resolved to an address, which is shown in the configuration section.",
        recommendation:
          "Treat this Safe as compromised until the singleton address is reviewed and confirmed safe. Pause all signing activity on this Safe.",
        evidence: {
          singleton: snapshot.singleton,
          abiReadable: false,
        },
        relatedIncident: incidentReferences.wazirx,
      }),
    );
  }

  if (snapshot.classifications?.singleton.status === "unknown") {
    findings.push(
      createFinding({
        id: "unknown-singleton",
        severity: "critical",
        category: "component",
        confidence: "high",
        title: "Unknown Safe singleton detected",
        userExplanation:
          "The Safe proxy points to a singleton that is not in the local known-component registry.",
        technicalExplanation:
          "The singleton/mastercopy storage slot resolved to an address not recognized as an official Safe or SafeL2 singleton.",
        recommendation:
          "Verify the singleton source code and deployment history before trusting this Safe.",
        evidence: snapshot.classifications.singleton,
        relatedIncident: incidentReferences.bybit,
      }),
    );
  }

  if (snapshot.classifications?.fallbackHandler.status === "unknown") {
    findings.push(
      createFinding({
        id: "unknown-fallback-handler",
        severity: "medium",
        category: "component",
        confidence: "medium",
        title: "Unknown fallback handler detected",
        userExplanation:
          "The Safe uses a fallback handler that is not in the Safe official deployment registry.",
        technicalExplanation:
          "The fallback handler storage slot resolved to an unrecognized contract address.",
        recommendation:
          "Verify whether this handler is expected and remove it if it is not required.",
        evidence: snapshot.classifications.fallbackHandler,
        relatedIncident: incidentReferences.wazirx,
      }),
    );
  }

  for (const moduleClassification of snapshot.classifications?.modules ?? []) {
    if (moduleClassification.status === "unknown") {
      findings.push(
        createFinding({
          id: "unknown-module",
          severity: "high",
          category: "component",
          confidence: "high",
          title: "Unknown module detected",
          userExplanation:
            "This Safe has an enabled module that is not in the known Safe registry. This does not prove it is malicious, but modules can add powerful execution paths.",
          technicalExplanation:
            "getModulesPaginated() returned a module address missing from the Safe official deployment registry. Custom modules are possible.",
          recommendation:
            "Manual review required. Verify the module source and confirm it is explicitly approved.",
          evidence: moduleClassification,
          relatedIncident: incidentReferences.bybit,
        }),
      );
    }
  }

  if (snapshot.classifications?.guard.status === "unknown") {
    findings.push(
      createFinding({
        id: "unknown-guard",
        severity: "medium",
        category: "component",
        confidence: "medium",
        title: "Unknown guard configured",
        userExplanation:
          "This Safe uses a guard that is not in the Safe official deployment registry. Custom guards are common, but they should be reviewed.",
        technicalExplanation:
          "The guard storage slot resolved to an unrecognized contract address.",
        recommendation:
          "Manual review required. Verify whether this guard is expected and review its source before relying on it.",
        evidence: snapshot.classifications.guard,
      }),
    );
  }

  findings.push(...evaluateNoCodeFindings(snapshot));

  if (!snapshot.guard) {
    findings.push(
      createFinding({
        id: "no-guard",
        severity: "low",
        category: "operational",
        confidence: "high",
        title: "No guard configured",
        userExplanation:
          "This Safe has no guard enforcing extra policy checks. This is common, but higher-value Safes may want one.",
        technicalExplanation:
          "The guard storage slot is empty. The Safe will rely on its base threshold and modules without additional guard policy.",
        recommendation:
          "Decide whether this Safe needs a guard based on treasury size and operational risk.",
        evidence: { guard: snapshot.guard },
      }),
    );
  }

  findings.push(
    createFinding({
      id: "static-scan-limitation",
      severity: "info",
      category: "limitation",
      confidence: "high",
      title: "Static scan cannot verify signer intent",
      userExplanation:
        "This address-only scan cannot detect malicious transaction prompts before signers approve them.",
      technicalExplanation:
        "Bybit, Radiant, and WazirX-style incidents require transaction simulation and signer-intent verification, which are outside Phase 1.",
      recommendation:
        "Use this scanner to review the Safe's current setup. It does not inspect pending transactions or verify what signers see before approval.",
      evidence: { phase: "address-scan", simulation: false },
      relatedIncident: incidentReferences.radiant,
    }),
  );

  return sortFindings(findings);
}

function evaluateNoCodeFindings(snapshot: SafeSnapshot): RiskFinding[] {
  const componentClassifications = [
    snapshot.classifications?.singleton,
    snapshot.classifications?.fallbackHandler,
    snapshot.classifications?.guard,
    ...(snapshot.classifications?.modules ?? []),
  ].filter((classification) => classification?.address);

  return componentClassifications.flatMap((classification): RiskFinding[] => {
    if (!classification || classification.hasCode !== false) {
      return [];
    }

    const componentType = classification.type ?? "component";

    return [
      createFinding({
        id: `component-no-code-${componentType}`,
        severity: "critical",
        category: "component",
        confidence: "high",
        title: `No contract code found at ${formatComponentType(componentType)} address`,
        userExplanation:
          "A Safe component address resolved from chain has no deployed bytecode. This should not happen for active Safe components.",
        technicalExplanation:
          "The scanner called eth_getCode for an unknown component address and the RPC returned 0x.",
        recommendation:
          "Treat this Safe as unsafe until the component address and deployment history are verified.",
        evidence: classification,
      }),
    ];
  });
}

function formatComponentType(type: string): string {
  return type.replaceAll("_", " ");
}

export function evaluateChangeRisk(changes: SnapshotChange[]): RiskFinding[] {
  const findings = changes
    .map((change): RiskFinding | null => {
      if (change.type === "owner_added") {
        return createFinding({
          id: "change-owner-added",
          severity: "critical",
          category: "change",
          confidence: "high",
          title: "Owner added since last scan",
          userExplanation:
            "A new owner appeared since the last local scan. If this was not expected, treat it as urgent.",
          technicalExplanation:
            "Snapshot comparison detected an address in the current owner set that was absent from the previous scan.",
          recommendation:
            "Confirm this owner addition through your governance or operations records.",
          evidence: change,
          relatedIncident: incidentReferences.ronin,
        });
      }

      if (change.type === "threshold_changed") {
        const lowered =
          typeof change.before === "number" &&
          typeof change.after === "number" &&
          change.after < change.before;

        return createFinding({
          id: lowered ? "change-threshold-lowered" : "change-threshold-raised",
          severity: lowered ? "critical" : "medium",
          category: "change",
          confidence: "high",
          title: lowered
            ? "Threshold lowered since last scan"
            : "Threshold changed since last scan",
          userExplanation: lowered
            ? "The Safe now requires fewer approvals than before. If unexpected, this can be an early attack signal."
            : "The Safe approval threshold changed since the last local scan.",
          technicalExplanation:
            "Snapshot comparison found a different getThreshold() value for the same Safe and chain.",
          recommendation:
            "Confirm the threshold change was intentional and approved through the expected process.",
          evidence: change,
          relatedIncident: lowered ? incidentReferences.ronin : undefined,
        });
      }

      if (change.type === "module_added") {
        return createFinding({
          id: "change-module-added",
          severity: "high",
          category: "change",
          confidence: "high",
          title: "Module added since last scan",
          userExplanation:
            "A new module appeared since the last scan. Modules can create execution paths outside normal owner approvals.",
          technicalExplanation:
            "Snapshot comparison detected a new address from getModulesPaginated().",
          recommendation:
            "Verify this module source and confirm it was intentionally enabled.",
          evidence: change,
          relatedIncident: incidentReferences.bybit,
        });
      }

      if (change.type === "singleton_changed") {
        return createFinding({
          id: "change-singleton-changed",
          severity: "critical",
          category: "change",
          confidence: "high",
          title: "Singleton changed since last scan",
          userExplanation:
            "The Safe implementation address changed since the last scan. This is one of the highest-risk configuration changes.",
          technicalExplanation:
            "Snapshot comparison detected a different singleton/mastercopy storage slot value.",
          recommendation:
            "Pause operations until the implementation change is verified.",
          evidence: change,
          relatedIncident: incidentReferences.bybit,
        });
      }

      if (change.type === "guard_changed") {
        return createFinding({
          id:
            change.after === null ? "change-guard-removed" : "change-guard-changed",
          severity: change.after === null ? "high" : "medium",
          category: "change",
          confidence: "high",
          title:
            change.after === null
              ? "Guard removed since last scan"
              : "Guard changed since last scan",
          userExplanation:
            "The Safe guard changed since the last scan. This may alter policy checks around execution.",
          technicalExplanation:
            "Snapshot comparison detected a different guard storage slot value.",
          recommendation:
            "Confirm this guard change was expected and review the guard contract.",
          evidence: change,
        });
      }

      if (change.type === "fallback_handler_changed") {
        return createFinding({
          id: "change-fallback-handler-changed",
          severity: "high",
          category: "change",
          confidence: "high",
          title: "Fallback handler changed since last scan",
          userExplanation:
            "The fallback handler changed since the last scan. This can affect how the Safe responds to calls and signatures.",
          technicalExplanation:
            "Snapshot comparison detected a different fallback handler storage slot value.",
          recommendation:
            "Verify the fallback handler change before trusting this Safe.",
          evidence: change,
          relatedIncident: incidentReferences.wazirx,
        });
      }

      return null;
    })
    .filter((finding): finding is RiskFinding => finding !== null);

  return sortFindings(findings);
}

export function calculateSecurityScore(findings: RiskFinding[]): number {
  const totalPenalty = findings.reduce(
    (sum, finding) => sum + scorePenalty[finding.severity],
    0,
  );

  return Math.max(0, 100 - totalPenalty);
}

export function selectPrimaryFindings(
  findings: RiskFinding[],
  limit = 2,
): RiskFinding[] {
  return sortFindings(findings)
    .filter((finding) => finding.severity !== "info")
    .slice(0, limit);
}

function createFinding(params: {
  id: string;
  severity: RiskSeverity;
  category: RiskCategory;
  confidence: RiskConfidence;
  title: string;
  userExplanation: string;
  technicalExplanation: string;
  recommendation: string;
  evidence?: unknown;
  relatedIncident?: IncidentReference;
}): RiskFinding {
  return {
    ...params,
    explanation: params.userExplanation,
  };
}

function sortFindings(findings: RiskFinding[]): RiskFinding[] {
  return [...findings].sort((left, right) => {
    const severityOrder = severityRank[right.severity] - severityRank[left.severity];

    if (severityOrder !== 0) {
      return severityOrder;
    }

    return left.id.localeCompare(right.id);
  });
}
