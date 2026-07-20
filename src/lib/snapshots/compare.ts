import type { Address, SafeSnapshot, SnapshotChange } from "@/lib/safe/types";

export function compareSnapshots(
  previous: SafeSnapshot | null,
  current: SafeSnapshot,
): SnapshotChange[] {
  if (!previous) {
    return [];
  }

  const changes: SnapshotChange[] = [];

  if (current.owners && previous.owners) {
    for (const owner of difference(current.owners, previous.owners)) {
      changes.push({
        type: "owner_added",
        severity: "critical",
        title: "Owner added",
        before: previous.owners,
        after: owner,
      });
    }

    for (const owner of difference(previous.owners, current.owners)) {
      changes.push({
        type: "owner_removed",
        severity: "high",
        title: "Owner removed",
        before: owner,
        after: current.owners,
      });
    }
  }

  if (
    previous.threshold !== null &&
    current.threshold !== null &&
    previous.threshold !== current.threshold
  ) {
    changes.push({
      type: "threshold_changed",
      severity: current.threshold < previous.threshold ? "critical" : "medium",
      title: "Threshold changed",
      before: previous.threshold,
      after: current.threshold,
    });
  }

  if (current.modules && previous.modules) {
    for (const moduleAddress of difference(current.modules, previous.modules)) {
      changes.push({
        type: "module_added",
        severity: "high",
        title: "Module added",
        before: previous.modules,
        after: moduleAddress,
      });
    }

    for (const moduleAddress of difference(previous.modules, current.modules)) {
      changes.push({
        type: "module_removed",
        severity: "medium",
        title: "Module removed",
        before: moduleAddress,
        after: current.modules,
      });
    }
  }

  if (normalize(previous.guard) !== normalize(current.guard)) {
    changes.push({
      type: "guard_changed",
      severity: current.guard ? "high" : "medium",
      title: "Guard changed",
      before: previous.guard,
      after: current.guard,
    });
  }

  if (normalize(previous.fallbackHandler) !== normalize(current.fallbackHandler)) {
    changes.push({
      type: "fallback_handler_changed",
      severity: "high",
      title: "Fallback handler changed",
      before: previous.fallbackHandler,
      after: current.fallbackHandler,
    });
  }

  if (normalize(previous.singleton) !== normalize(current.singleton)) {
    changes.push({
      type: "singleton_changed",
      severity: "critical",
      title: "Singleton changed",
      before: previous.singleton,
      after: current.singleton,
    });
  }

  return changes;
}

function difference(left: Address[], right: Address[]): Address[] {
  const rightSet = new Set(right.map(normalize));
  return left.filter((item) => !rightSet.has(normalize(item)));
}

function normalize(address: Address | null): string {
  return address?.toLowerCase() ?? "none";
}
