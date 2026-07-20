import { isAddress, isHex, toHex } from "viem";
import { NextResponse } from "next/server";
import { getGoPlusAccessToken } from "../../../../lib/goplus/server";
import { SIMULATION_SUPPORTED_CHAINS } from "../../../../lib/tx-xray/simulationChains";

export const runtime = "nodejs";

const SIMULATION_URL = "https://api.gopluslabs.io/api/v1/transaction_simulation";

type RequestBody = {
  safeAddress: string;
  chainId: number;
  to: string;
  value: string;
  data: string;
  operation: number;
  safeTxGas?: string;
  gasPrice?: string;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isAddress(body.safeAddress) || !isAddress(body.to) || !isHex(body.data)) {
    return NextResponse.json({ error: "Valid safeAddress, to, and hex data fields are required." }, { status: 400 });
  }

  const chainId = SIMULATION_SUPPORTED_CHAINS.get(body.chainId);
  if (!chainId) {
    return NextResponse.json({ error: "GoPlus transaction simulation currently supports Ethereum, BNB Chain, and Base only." }, { status: 422 });
  }

  // DELEGATECALL (operation 1) cannot be faithfully simulated as a plain call:
  // the Safe would execute the target's code in its own context. We still run
  // the simulation as a best-effort CALL against the target so users get some
  // signal, and flag the result as advisory.
  const isDelegateCall = body.operation !== 0;

  try {
    const token = await getGoPlusAccessToken();
    const gasLimit = parseQuantity(body.safeTxGas, 30_000_000n);
    const gasPrice = parseQuantity(body.gasPrice, 0n);
    const response = await fetch(SIMULATION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chain_id: chainId,
        from: body.safeAddress,
        to: body.to,
        value: toHex(parseQuantity(body.value, 0n)),
        data: body.data,
        gas_limit: toHex(gasLimit),
        gas_price: toHex(gasPrice),
        nonce: "0x0",
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null) as { code?: number; message?: string } | null;
    if (!response.ok || !payload || payload.code !== 1) {
      const message = payload?.message || `GoPlus returned HTTP ${response.status}.`;
      const status = payload?.code === 4029 ? 429 : 502;
      return NextResponse.json({ error: message }, { status });
    }

    if (isDelegateCall) {
      return NextResponse.json({
        ...payload,
        advisory:
          "This Safe transaction is a DELEGATECALL. The simulation ran the target contract as a plain CALL, so it cannot show what the Safe would actually execute in its own context. Treat the result as a weak signal only.",
      });
    }

    return NextResponse.json(payload);
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "GoPlus simulation failed." },
      { status: 502 },
    );
  }
}

function parseQuantity(value: string | undefined, fallback: bigint): bigint {
  if (!value) return fallback;
  try {
    const parsed = BigInt(value);
    return parsed >= 0n ? parsed : fallback;
  } catch {
    return fallback;
  }
}
