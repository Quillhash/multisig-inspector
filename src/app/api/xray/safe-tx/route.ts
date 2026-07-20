import { NextResponse } from "next/server";
import { SAFE_PREFIX_TO_CHAIN } from "../../../../lib/chains/safePrefixes";

export const runtime = "nodejs";

const SAFE_TX_SERVICE_BASE = "https://api.safe.global/tx-service";
const SAFE_TX_SERVICE_API_KEY = process.env.SAFE_TX_SERVICE_API_KEY;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type RequestBody = {
  chainId: number;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
};

// Restrict proxying to read-only Safe Transaction Service endpoints so the
// route cannot be abused as an open proxy.
const ALLOWED_PATHS =
  /^\/?(safes\/0x[a-fA-F0-9]{40}\/(multisig-transactions|modules|delegates|transfers|incoming-transfers)|multisig-transactions\/0x[a-fA-F0-9]{64})\/?$/;

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.chainId !== "number" || typeof body.path !== "string") {
    return NextResponse.json(
      { error: "chainId and path are required." },
      { status: 400 },
    );
  }

  const prefix = prefixForChain(body.chainId);
  if (!prefix) {
    return NextResponse.json({ error: "Unsupported chain." }, { status: 400 });
  }

  const normalizedPath = body.path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!ALLOWED_PATHS.test(normalizedPath)) {
    return NextResponse.json(
      { error: "Unsupported Safe Transaction Service endpoint." },
      { status: 400 },
    );
  }

  const query = new URLSearchParams();
  const limit = clampLimit(body.query?.limit);
  query.set("limit", String(limit));
  for (const [key, value] of Object.entries(body.query ?? {})) {
    if (key === "limit") continue;
    if (value === undefined || value === null) continue;
    query.set(key, String(value));
  }

  const url = `${SAFE_TX_SERVICE_BASE}/${prefix}/api/v1/${normalizedPath}/?${query.toString()}`;
  const headers: Record<string, string> = { accept: "application/json" };
  if (SAFE_TX_SERVICE_API_KEY) {
    // Forward an API key when configured, so the tool keeps working if Safe
    // gates these endpoints behind authentication in the future.
    headers.Authorization = `Token ${SAFE_TX_SERVICE_API_KEY}`;
  }

  try {
    const upstream = await fetch(url, { headers, cache: "no-store" });
    const text = await upstream.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text || null;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: upstreamError(upstream.status), upstream: payload },
        { status: upstream.status },
      );
    }

    return NextResponse.json(payload, {
      headers: { "cache-control": "no-store" },
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Safe Transaction Service request failed.",
      },
      { status: 502 },
    );
  }
}

function prefixForChain(chainId: number): string | undefined {
  return Object.entries(SAFE_PREFIX_TO_CHAIN).find(
    ([, id]) => id === chainId,
  )?.[0];
}

function clampLimit(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function upstreamError(status: number): string {
  if (status === 404) {
    return "Not found on the Safe Transaction Service.";
  }
  if (status === 429) {
    return "The Safe Transaction Service is rate-limiting requests. Wait a moment and try again.";
  }
  if (status === 401 || status === 403) {
    return "The Safe Transaction Service requires authorization for this endpoint.";
  }
  return `Safe Transaction Service returned HTTP ${status}.`;
}
