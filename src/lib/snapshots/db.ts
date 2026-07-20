"use client";

import Dexie, { type EntityTable } from "dexie";
import type { SafeSnapshot } from "@/lib/safe/types";

export type StoredSafeSnapshot = SafeSnapshot & {
  id?: number;
  snapshotKey: string;
};

const db = new Dexie("safe-security-inspector") as Dexie & {
  snapshots: EntityTable<StoredSafeSnapshot, "id">;
};

db.version(1).stores({
  snapshots: "++id, snapshotKey, safeAddress, chainId, timestamp",
});

export function createSnapshotKey(snapshot: Pick<SafeSnapshot, "safeAddress" | "chainId">) {
  return `${snapshot.chainId}:${snapshot.safeAddress.toLowerCase()}`;
}

export async function saveSnapshot(
  snapshot: SafeSnapshot,
): Promise<number | undefined> {
  return db.snapshots.add({
    ...snapshot,
    snapshotKey: createSnapshotKey(snapshot),
  });
}

export async function getLatestSnapshot(
  safeAddress: SafeSnapshot["safeAddress"],
  chainId: number,
): Promise<StoredSafeSnapshot | null> {
  const snapshotKey = createSnapshotKey({ safeAddress, chainId });
  const snapshots = await db.snapshots.where("snapshotKey").equals(snapshotKey).toArray();

  return selectLatestSnapshot(snapshots);
}

export async function listSnapshots(): Promise<StoredSafeSnapshot[]> {
  return db.snapshots.orderBy("timestamp").reverse().toArray();
}

export function selectLatestSnapshot(
  snapshots: StoredSafeSnapshot[],
): StoredSafeSnapshot | null {
  return (
    snapshots.toSorted((left, right) => {
      const timestampOrder =
        Date.parse(right.timestamp) - Date.parse(left.timestamp);

      if (timestampOrder !== 0) {
        return timestampOrder;
      }

      return (right.id ?? 0) - (left.id ?? 0);
    })[0] ?? null
  );
}
