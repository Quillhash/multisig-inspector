import { getAddress } from "viem";
import { normalizeSafeTx } from "./normalizeSafeTx";
import type { SafeTxInput } from "./types";
import { createRpcClient } from "../chains/rpc";
import type { PublicClient } from "viem";

const PROXY_URL = "/api/xray/safe-tx";
const MAX_QUEUE_PAGES = 20;
const MAX_QUEUE_ITEMS = 2_000;
type Fetcher = typeof fetch;

const GUIDANCE_MESSAGE =
  "Couldn't resolve this hash on the Safe Transaction Service. If it's an on-chain transaction hash, paste the Safe's home URL to list its transactions and pick one instead.";

export class SafeTxNotFoundError extends Error {}

export type PendingSafeTxImportError = {
  kind: "invalid";
  index: number;
  nonce?: string;
  safeTxHash?: string;
  message: string;
};

export type PendingSafeTxItem = SafeTxInput | PendingSafeTxImportError;

export function isPendingSafeTxImportError(
  item: PendingSafeTxItem,
): item is PendingSafeTxImportError {
  return "kind" in item && item.kind === "invalid";
}

export function isPendingSafeTxInput(
  item: PendingSafeTxItem,
): item is SafeTxInput {
  return !isPendingSafeTxImportError(item);
}

export function filterExecutableNonceRange(
  items: PendingSafeTxItem[],
  currentNonce: bigint,
): PendingSafeTxItem[] {
  return items.filter((item) => {
    const nonce = item.nonce;
    if (nonce === undefined || !/^\d+$/.test(nonce)) return true;
    return BigInt(nonce) >= currentNonce;
  });
}

export type SafeTxListResult = {
  results: PendingSafeTxItem[];
  count: number;
  nextOffset: number | null;
};

export type SafeTxListQuery = {
  executed?: boolean;
  offset?: number;
  limit?: number;
  transaction_hash?: string;
};

export type SafeTxQueueStatus = "awaiting" | "ready";

export function classifySafeTransaction(
  transaction: SafeTxInput,
): SafeTxQueueStatus {
  const confirmations = transaction.confirmations ?? 0;
  const required = transaction.confirmationsRequired;
  return required !== undefined && required > 0 && confirmations >= required
    ? "ready"
    : "awaiting";
}

function normalizeApiTx(value: Record<string, unknown>, chainId: number): SafeTxInput {
  return normalizeSafeTx({
    ...value,
    source: "safe-api",
    chainId,
    safeAddress: value.safe,
    data: value.data ?? "0x",
    providedSafeTxHash: value.safeTxHash,
    apiTxHash: value.safeTxHash as SafeTxInput["apiTxHash"],
    signatures: typeof value.signatures === "string" ? value.signatures : undefined,
    confirmations: typeof value.confirmations === "object" && Array.isArray(value.confirmations) ? value.confirmations : undefined,
    confirmationsRequired:
      typeof value.confirmationsRequired === "number"
        ? value.confirmationsRequired
        : undefined,
  });
}

function mapProxyError(status: number, fallback: string): string {
  if (status === 404) {
    return "Transaction not found on the Safe Transaction Service. Paste the transaction JSON or enter fields manually.";
  }
  if (status === 429) {
    return "The Safe Transaction Service is rate-limiting requests. Wait a moment and try again.";
  }
  if (status === 401 || status === 403) {
    return "The Safe Transaction Service now requires an API key for this endpoint. Paste the transaction JSON or enter fields manually.";
  }
  return fallback;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    const fallback = `The Safe Transaction Service is temporarily unavailable (HTTP ${response.status}). You can paste the transaction JSON or enter fields manually instead.`;
    let message = fallback;
    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      if (payload?.error) message = payload.error;
      else if (payload?.message) message = payload.message;
    } catch {
      // keep the default message
    }
    const mapped = mapProxyError(response.status, message);
    if (response.status === 404) {
      throw new SafeTxNotFoundError(mapped);
    }
    throw new Error(mapped);
  }
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(
      "Could not import from the Safe Transaction Service. Please paste the transaction JSON or enter fields manually.",
    );
  }
}

function parseNextOffset(next: unknown): number | null {
  if (typeof next !== "string" || !next) return null;
  try {
    const url = new URL(next);
    const offset = url.searchParams.get("offset");
    if (offset === null) return null;
    const parsed = Number(offset);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function fetchSafeTransaction(
  chainId: number,
  transactionId: string,
  fetcher: Fetcher = fetch,
): Promise<SafeTxInput> {
  const response = await fetcher(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chainId,
      path: `multisig-transactions/${transactionId}`,
    }),
  });
  const payload = await readJson(response);
  return normalizeApiTx(payload, chainId);
}

export async function fetchSafeTransactions(
  chainId: number,
  safeAddress: string,
  query: SafeTxListQuery = {},
  fetcher: Fetcher = fetch,
): Promise<SafeTxListResult> {
  const response = await fetcher(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chainId,
      path: `safes/${safeAddress}/multisig-transactions`,
      query: {
        ordering: "-nonce",
        executed: query.executed,
        offset: query.offset,
        limit: query.limit,
        transaction_hash: query.transaction_hash,
      },
    }),
  });

  const payload = await readJson(response);
  if (!Array.isArray(payload.results)) {
    throw new Error(
      "Safe queue response had an unexpected format. Please paste the transaction JSON or enter fields manually.",
    );
  }

  const results = payload.results.map<PendingSafeTxItem>((item, index) => {
    const record =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    try {
      const transaction = normalizeApiTx(record, chainId);
      if (transaction.safeAddress !== getAddress(safeAddress)) {
        throw new Error("Safe address mismatch.");
      }
      return transaction;
    } catch {
      const nonce = record.nonce === undefined ? undefined : String(record.nonce);
      const safeTxHash =
        typeof record.safeTxHash === "string" ? record.safeTxHash : undefined;
      return {
        kind: "invalid",
        index,
        nonce,
        safeTxHash,
        message: `Transaction ${nonce !== undefined ? `at nonce ${nonce}` : `item ${index + 1}`} could not be imported. Paste this transaction's JSON or enter its fields manually.`,
      };
    }
  });

  return {
    results,
    count: typeof payload.count === "number" ? payload.count : results.length,
    nextOffset: parseNextOffset(payload.next),
  };
}

export async function fetchPendingSafeTransactions(
  chainId: number,
  safeAddress: string,
  fetcher: Fetcher = fetch,
): Promise<PendingSafeTxItem[]> {
  const page = await fetchSafeTransactions(
    chainId,
    safeAddress,
    { executed: false },
    fetcher,
  );
  return page.results;
}

export async function fetchAllSafeTransactions(
  chainId: number,
  safeAddress: string,
  query: SafeTxListQuery = {},
  fetcher: Fetcher = fetch,
): Promise<PendingSafeTxItem[]> {
  const results: PendingSafeTxItem[] = [];
  const seenOffsets = new Set<number>();
  let offset = query.offset;
  let pageCount = 0;

  do {
    pageCount += 1;
    if (pageCount > MAX_QUEUE_PAGES) {
      throw new Error("Safe queue is too large to load safely. Narrow the transaction list and try again.");
    }
    if (offset !== undefined) {
      if (seenOffsets.has(offset)) {
        throw new Error("Safe queue pagination returned a repeated cursor.");
      }
      seenOffsets.add(offset);
    }

    const page = await fetchSafeTransactions(
      chainId,
      safeAddress,
      { ...query, limit: query.limit ?? 100, offset },
      fetcher,
    );
    results.push(...page.results);
    if (results.length > MAX_QUEUE_ITEMS) {
      throw new Error("Safe queue is too large to load safely. Narrow the transaction list and try again.");
    }
    offset = page.nextOffset ?? undefined;
  } while (offset !== undefined);

  return results;
}

export async function resolveSafeTransaction(
  chainId: number,
  transactionId: string,
  options?: {
    fetcher?: Fetcher;
    getClient?: (chainId: number) => PublicClient;
  },
): Promise<SafeTxInput> {
  const fetcher = options?.fetcher ?? fetch;
  try {
    return await fetchSafeTransaction(chainId, transactionId, fetcher);
  } catch (error) {
    if (!(error instanceof SafeTxNotFoundError)) throw error;
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(transactionId)) {
    throw new Error(GUIDANCE_MESSAGE);
  }

  const client = (options?.getClient ?? createRpcClient)(chainId);
  let tx: { to?: unknown } | null;
  try {
    tx = await client.getTransaction({ hash: transactionId as `0x${string}` });
  } catch {
    throw new Error(GUIDANCE_MESSAGE);
  }
  if (!tx || !tx.to) {
    throw new Error(GUIDANCE_MESSAGE);
  }
  const safeAddress = getAddress(String(tx.to));

  const page = await fetchSafeTransactions(
    chainId,
    safeAddress,
    { transaction_hash: transactionId, limit: 1 },
    fetcher,
  );
  if (page.results.length === 0 || isPendingSafeTxImportError(page.results[0])) {
    throw new Error(GUIDANCE_MESSAGE);
  }
  return page.results[0] as SafeTxInput;
}
