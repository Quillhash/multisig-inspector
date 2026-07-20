import { describe, expect, it, vi } from "vitest";
import {
  classifySafeTransaction,
  fetchAllSafeTransactions,
  fetchPendingSafeTransactions,
  fetchSafeTransaction,
  fetchSafeTransactions,
  isPendingSafeTxImportError,
  isPendingSafeTxInput,
  resolveSafeTransaction,
} from "./fetchSafeTxFromApi";

const SAFE = "0x1111111111111111111111111111111111111111";
const TX = {
  safe: SAFE,
  to: SAFE,
  value: "0",
  data: "0x",
  operation: 0,
  nonce: 1,
  safeTxGas: "0",
  baseGas: "0",
  gasPrice: "0",
  gasToken: "0x0000000000000000000000000000000000000000",
  refundReceiver: "0x0000000000000000000000000000000000000000",
  safeTxHash: `0x${"ab".repeat(32)}`,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function postBody(fetcher: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = fetcher.mock.calls[0];
  return JSON.parse((call[1] as RequestInit).body as string);
}

describe("Safe Transaction Service importer (proxied)", () => {
  it("posts to the server proxy and normalizes a single transaction", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(TX));
    const result = await fetchSafeTransaction(1, TX.safeTxHash, fetcher);
    expect(result).toMatchObject({
      source: "safe-api",
      chainId: 1,
      safeAddress: SAFE,
      providedSafeTxHash: TX.safeTxHash,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/xray/safe-tx",
      expect.objectContaining({ method: "POST" }),
    );
    expect(postBody(fetcher).path).toBe(`multisig-transactions/${TX.safeTxHash}`);
  });

  it("returns the first page of pending transactions and a next-offset cursor", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        count: 30,
        next: "https://api.safe.global/tx-service/eth/api/v1/safes/0x1/multisig-transactions/?limit=20&offset=20",
        previous: null,
        results: [TX],
      }),
    );
    const page = await fetchSafeTransactions(1, SAFE, { executed: false }, fetcher);
    expect(page.results).toHaveLength(1);
    expect(page.count).toBe(30);
    expect(page.nextOffset).toBe(20);
    expect(postBody(fetcher)).toMatchObject({
      path: `safes/${SAFE}/multisig-transactions`,
      query: { executed: false, ordering: "-nonce" },
    });
  });

  it("keeps the legacy fetchPendingSafeTransactions array return shape", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ count: 1, next: null, previous: null, results: [TX] }),
    );
    const result = await fetchPendingSafeTransactions(1, SAFE, fetcher);
    expect(result).toHaveLength(1);
    expect(isPendingSafeTxImportError(result[0])).toBe(false);
  });

  it("fetches every pending transaction page", async () => {
    const secondTx = {
      ...TX,
      nonce: 2,
      safeTxHash: `0x${"cd".repeat(32)}`,
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          count: 2,
          next: "https://api.safe.global/tx-service/eth/api/v1/safes/0x1/multisig-transactions/?limit=1&offset=1",
          previous: null,
          results: [TX],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          count: 2,
          next: null,
          previous: "first-page",
          results: [secondTx],
        }),
      );

    const result = await fetchAllSafeTransactions(
      1,
      SAFE,
      { executed: false },
      fetcher,
    );

    expect(result).toHaveLength(2);
    expect(postBodyAt(fetcher, 1)).toMatchObject({
      query: { executed: false, offset: 1 },
    });
  });

  it("classifies confirmation progress into the three queue states", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        count: 3,
        next: null,
        previous: null,
        results: [
          { ...TX, confirmations: [], confirmationsRequired: 2 },
          {
            ...TX,
            nonce: 2,
            safeTxHash: `0x${"cd".repeat(32)}`,
            confirmations: [{ owner: SAFE, signature: "0x12", signatureType: "EOA" }],
            confirmationsRequired: 2,
          },
          {
            ...TX,
            nonce: 3,
            safeTxHash: `0x${"ef".repeat(32)}`,
            confirmations: [
              { owner: SAFE, signature: "0x12", signatureType: "EOA" },
              { owner: "0x2222222222222222222222222222222222222222", signature: "0x34", signatureType: "EOA" },
            ],
            confirmationsRequired: 2,
          },
        ],
      }),
    );
    const result = await fetchAllSafeTransactions(
      1,
      SAFE,
      { executed: false },
      fetcher,
    );
    const transactions = result.filter(isPendingSafeTxInput);

    expect(transactions.map(classifySafeTransaction)).toEqual([
      "awaiting",
      "awaiting",
      "ready",
    ]);
  });

  it("maps a 404 to a not-found message", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ error: "Not found on the Safe Transaction Service." }, 404),
    );
    await expect(fetchSafeTransaction(1, TX.safeTxHash, fetcher)).rejects.toThrow(
      /not found/i,
    );
  });

  it("maps a 429 to a rate-limit message", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ error: "rate-limiting" }, 429),
    );
    await expect(fetchSafeTransaction(1, TX.safeTxHash, fetcher)).rejects.toThrow(
      /rate-limit/i,
    );
  });

  it("maps a 401 to an api-key message", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ error: "authorization required" }, 401),
    );
    await expect(
      fetchSafeTransactions(1, SAFE, {}, fetcher),
    ).rejects.toThrow(/authorization|api key/i);
  });

  it("keeps valid queue items and returns item-specific guidance for malformed entries", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        count: 2,
        next: null,
        previous: null,
        results: [TX, { nonce: 9, safeTxHash: `0x${"cd".repeat(32)}` }],
      }),
    );
    const result = await fetchSafeTransactions(1, SAFE, {}, fetcher);
    expect(result.results).toHaveLength(2);
    expect(isPendingSafeTxImportError(result.results[0])).toBe(false);
    expect(isPendingSafeTxImportError(result.results[1])).toBe(true);
    if (isPendingSafeTxImportError(result.results[1])) {
      expect(result.results[1].message).toContain("nonce 9");
    }
  });

  it("rejects an unexpected queue envelope with fallback guidance", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ transactions: [] }),
    );
    await expect(fetchSafeTransactions(1, SAFE, {}, fetcher)).rejects.toThrow(
      "unexpected format",
    );
  });

  const ON_CHAIN_HASH = "0xfecfee98519dcaeecb839ffaf33225f732ef02f1d0ea0a9a32fed37be08aba13";
  const GUIDANCE = /Couldn't resolve this hash on the Safe Transaction Service/;

  function postBodyAt(fetcher: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> {
    const call = fetcher.mock.calls[index];
    return JSON.parse((call[1] as RequestInit).body as string);
  }

  it("falls back to the Safe address via RPC when a single-tx lookup 404s on an on-chain hash", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Not found on the Safe Transaction Service." }, 404))
      .mockResolvedValueOnce(
        jsonResponse({ count: 1, next: null, previous: null, results: [TX] }),
      );
    const getClient = vi.fn().mockReturnValue({
      getTransaction: vi.fn().mockResolvedValue({ to: SAFE }),
    });

    const result = await resolveSafeTransaction(1, ON_CHAIN_HASH, { fetcher, getClient });

    expect(result).toMatchObject({
      source: "safe-api",
      chainId: 1,
      safeAddress: SAFE,
      providedSafeTxHash: TX.safeTxHash,
    });
    expect(getClient).toHaveBeenCalledWith(1);
    expect(postBodyAt(fetcher, 0).path).toBe(`multisig-transactions/${ON_CHAIN_HASH}`);
    expect(postBodyAt(fetcher, 1)).toMatchObject({
      path: `safes/${SAFE}/multisig-transactions`,
    });
    expect(postBodyAt(fetcher, 1).query).toMatchObject({
      transaction_hash: ON_CHAIN_HASH,
      limit: 1,
    });
  });

  it("throws the guidance message when RPC cannot find the on-chain transaction", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ error: "Not found on the Safe Transaction Service." }, 404),
    );
    const getClient = vi.fn().mockReturnValue({
      getTransaction: vi.fn().mockResolvedValue(null),
    });

    await expect(
      resolveSafeTransaction(1, ON_CHAIN_HASH, { fetcher, getClient }),
    ).rejects.toThrow(GUIDANCE);
  });

  it("does not attempt fallback on a rate-limit (429)", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ error: "rate-limiting" }, 429),
    );
    const getClient = vi.fn();

    await expect(
      resolveSafeTransaction(1, ON_CHAIN_HASH, { fetcher, getClient }),
    ).rejects.toThrow(/rate-limit/i);
    expect(getClient).not.toHaveBeenCalled();
  });

  it("does not attempt RPC fallback for a non-64-hex id", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ error: "Not found on the Safe Transaction Service." }, 404),
    );
    const getClient = vi.fn();

    await expect(
      resolveSafeTransaction(1, "0xabc", { fetcher, getClient }),
    ).rejects.toThrow(GUIDANCE);
    expect(getClient).not.toHaveBeenCalled();
  });

  it("happy path with a valid safeTxHash does not call the fallback", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(TX));
    const getClient = vi.fn();

    const result = await resolveSafeTransaction(1, TX.safeTxHash, { fetcher, getClient });
    expect(result).toMatchObject({
      source: "safe-api",
      chainId: 1,
      safeAddress: SAFE,
      providedSafeTxHash: TX.safeTxHash,
    });
    expect(getClient).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
