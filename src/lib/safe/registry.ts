import {
  classifyKnownComponent,
  SAFE_DEPLOYMENTS_SOURCE_LABEL,
} from "../safeRegistry";
import type { Address, ClassifiedAddress, SafeComponentType } from "./types";

export const safeRegistryMetadata = {
  sourceUrl: "https://github.com/safe-global/safe-deployments",
  source: SAFE_DEPLOYMENTS_SOURCE_LABEL,
  generatedAt: "runtime-from-package",
  safeVersionsCovered: ["1.0.0", "1.1.1", "1.2.0", "1.3.0", "1.4.1", "1.5.0"],
};

export function classifySafeComponents(params: {
  chainId: number;
  singleton: Address | null;
  fallbackHandler: Address | null;
  guard: Address | null;
  modules: Address[];
}) {
  return {
    singleton: classifyAddress(params.singleton, params.chainId, "singleton"),
    fallbackHandler: classifyAddress(
      params.fallbackHandler,
      params.chainId,
      "fallback_handler",
      "No fallback handler",
    ),
    guard: classifyAddress(
      params.guard,
      params.chainId,
      "guard",
      "No guard configured",
    ),
    modules: params.modules.map((moduleAddress) =>
      classifyAddress(moduleAddress, params.chainId, "module"),
    ),
  };
}

function classifyAddress(
  address: Address | null,
  chainId: number,
  type: SafeComponentType,
  emptyLabel?: string,
): ClassifiedAddress {
  if (!address && emptyLabel) {
    return {
      address,
      label: emptyLabel,
      status: "known",
      type,
    };
  }

  const classification = classifyKnownComponent(address, chainId, type);

  return {
    address,
    label: classification.label,
    status: classification.status,
    source: classification.source,
    type,
    reviewType:
      classification.status === "unknown"
        ? getManualReviewType(type)
        : undefined,
    reviewReason:
      classification.status === "unknown"
        ? getManualReviewReason(type)
        : undefined,
  };
}

function getManualReviewType(type: SafeComponentType) {
  if (type === "singleton") {
    return "critical_manual_review_required";
  }

  return "manual_review_recommended";
}

function getManualReviewReason(type: SafeComponentType) {
  if (type === "module") {
    return "Module not found in known Safe registry. Custom modules are possible.";
  }

  if (type === "guard") {
    return "Custom guards are common. Unknown guards should be reviewed.";
  }

  return "Component not found in known Safe registry.";
}
