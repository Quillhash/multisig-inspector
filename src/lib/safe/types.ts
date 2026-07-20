export type Address = `0x${string}`;

export type SafeComponentStatus = "known" | "unknown" | "suspicious";

export type SafeComponentType =
  | "singleton"
  | "fallback_handler"
  | "module"
  | "guard"
  | "factory"
  | "library";

export type ClassifiedAddress = {
  address: Address | null;
  label: string;
  status: SafeComponentStatus;
  type?: SafeComponentType;
  source?: string;
  reviewType?:
    | "critical_manual_review_required"
    | "manual_review_recommended";
  reviewReason?: string;
  hasCode?: boolean;
};

export type SafeSnapshot = {
  safeAddress: Address;
  chainId: number;
  blockNumber: bigint;
  timestamp: string;
  owners: Address[] | null;
  threshold: number | null;
  nonce: bigint | null;
  modules: Address[] | null;
  guard: Address | null;
  fallbackHandler: Address | null;
  singleton: Address | null;
  version?: string;
  abiReadable: boolean;
  classifications?: {
    singleton: ClassifiedAddress;
    fallbackHandler: ClassifiedAddress;
    guard: ClassifiedAddress;
    modules: ClassifiedAddress[];
  };
};

export type RiskSeverity = "critical" | "high" | "medium" | "low" | "info";
export type RiskCategory =
  | "ownership"
  | "component"
  | "change"
  | "operational"
  | "limitation";
export type RiskConfidence = "high" | "medium" | "low";

export type IncidentReference = {
  id: "bybit" | "radiant" | "wazirx" | "ronin" | "harmony";
  name: string;
  year: number;
  pattern: string;
  url: string;
};

export type RiskFinding = {
  id: string;
  severity: RiskSeverity;
  category: RiskCategory;
  confidence: RiskConfidence;
  title: string;
  explanation: string;
  userExplanation: string;
  technicalExplanation: string;
  recommendation: string;
  relatedIncident?: IncidentReference;
  evidence?: unknown;
};

export type SnapshotChangeType =
  | "owner_added"
  | "owner_removed"
  | "threshold_changed"
  | "module_added"
  | "module_removed"
  | "guard_changed"
  | "fallback_handler_changed"
  | "singleton_changed";

export type SnapshotChange = {
  type: SnapshotChangeType;
  severity: RiskSeverity;
  title: string;
  before: unknown;
  after: unknown;
};
