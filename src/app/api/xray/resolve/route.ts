import { getAddress, isAddress } from "viem";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RequestBody = {
  chainId: number;
  address: string;
  selector?: string;
};

type ResolveResult = {
  abi: unknown[] | null;
  signature: string | null;
};

// Process-lifetime cache. Verified ABIs and 4-byte signatures effectively never
// change, so caching avoids hammering the upstream directories.
const abiCache = new Map<string, unknown[] | null>();
const signatureCache = new Map<string, string | null>();

const SELECTOR_RE = /^0x[0-9a-fA-F]{8}$/;

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Number.isInteger(body.chainId) || !isAddress(body.address)) {
    return NextResponse.json({ error: "A valid chainId and address are required." }, { status: 400 });
  }
  const selector =
    typeof body.selector === "string" && SELECTOR_RE.test(body.selector)
      ? body.selector.toLowerCase()
      : null;

  const address = getAddress(body.address);
  const [abi, signature] = await Promise.all([
    resolveAbi(body.chainId, address),
    selector ? resolveSignature(selector) : Promise.resolve(null),
  ]);

  return NextResponse.json({ abi, signature } satisfies ResolveResult);
}

async function resolveAbi(chainId: number, address: string): Promise<unknown[] | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
  if (abiCache.has(key)) return abiCache.get(key) ?? null;

  let abi: unknown[] | null = null;
  for (const match of ["full_match", "partial_match"] as const) {
    const url = `https://repo.sourcify.dev/contracts/${match}/${chainId}/${address}/metadata.json`;
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) continue;
      const metadata = (await response.json()) as { output?: { abi?: unknown[] } };
      if (Array.isArray(metadata.output?.abi)) {
        abi = metadata.output.abi;
        break;
      }
    } catch {
      // try next match type / fall through to null
    }
  }

  abiCache.set(key, abi);
  return abi;
}

async function resolveSignature(selector: string): Promise<string | null> {
  if (signatureCache.has(selector)) return signatureCache.get(selector) ?? null;

  let signature: string | null = null;
  try {
    const url = `https://api.openchain.xyz/signature-database/v1/lookup?function=${selector}&filter=true`;
    const response = await fetchWithTimeout(url);
    if (response.ok) {
      const payload = (await response.json()) as {
        ok?: boolean;
        result?: { function?: Record<string, Array<{ name?: string }>> };
      };
      const candidates = payload.result?.function?.[selector];
      const name = candidates?.find((entry) => entry.name)?.name;
      if (name) signature = name;
    }
  } catch {
    // leave as null
  }

  signatureCache.set(selector, signature);
  return signature;
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store", headers: { accept: "application/json" } });
  } finally {
    clearTimeout(timer);
  }
}
