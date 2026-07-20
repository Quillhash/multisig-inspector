import "server-only";

import { createHash } from "node:crypto";

const TOKEN_URL = "https://api.gopluslabs.io/api/v1/token";
const EXPIRY_SAFETY_WINDOW_MS = 60_000;

let cachedToken: { value: string; expiresAt: number } | undefined;
let pendingToken: Promise<string> | undefined;

type TokenResponse = {
  code?: number;
  message?: string;
  result?: { access_token?: string; expires_in?: number };
};

export async function getGoPlusAccessToken(fetcher: typeof fetch = fetch): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - EXPIRY_SAFETY_WINDOW_MS) {
    return cachedToken.value;
  }

  if (pendingToken) return pendingToken;

  pendingToken = requestAccessToken(fetcher).finally(() => {
    pendingToken = undefined;
  });
  return pendingToken;
}

async function requestAccessToken(fetcher: typeof fetch): Promise<string> {
  const appKey = process.env.GOPLUS_APP_KEY;
  const appSecret = process.env.GOPLUS_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error("GoPlus simulation is not configured on this server.");
  }

  const time = Math.floor(Date.now() / 1000);
  const sign = createHash("sha1").update(`${appKey}${time}${appSecret}`).digest("hex");
  const response = await fetcher(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_key: appKey, time, sign }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GoPlus authentication returned HTTP ${response.status}.`);
  }

  const payload = await response.json() as TokenResponse;
  const token = payload.result?.access_token;
  if (payload.code !== 1 || !token) {
    throw new Error(payload.message || "GoPlus authentication failed.");
  }

  const expiresInSeconds = payload.result?.expires_in ?? 7_200;
  cachedToken = { value: token, expiresAt: Date.now() + expiresInSeconds * 1_000 };
  return token;
}
