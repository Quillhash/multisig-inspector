import type { Address } from "viem";
import { getSupportedChain } from "../chains/chains";
import { formatReadableUnits } from "./formatActionAmounts";
import type { SafeTxEnrichment, SafeTxInput, TransactionSimulation } from "./types";

type GoPlusResponse = {
  code?: number;
  message?: string;
  advisory?: string;
  result?: {
    is_simulated?: boolean;
    is_revert?: boolean;
    revert_reason?: string;
    simulate_failed_reason?: string;
    used_gas?: string | number;
    flagged?: boolean;
    native_balance_changes?: Array<{
      address?: string;
      before?: string;
      after?: string;
      change?: string;
    }>;
    erc20_balance_changes?: Array<{
      address?: string;
      erc20_change?: Array<{ token_address?: string; change?: string }>;
    }>;
  };
  error?: string;
};

type Fetcher = typeof fetch;

export async function simulateTransaction(
  input: SafeTxInput,
  enrichment: SafeTxEnrichment = { limitations: [] },
  fetcher: Fetcher = fetch,
): Promise<TransactionSimulation> {
  try {
    const response = await fetcher("/api/xray/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        safeAddress: input.safeAddress,
        chainId: input.chainId,
        to: input.to,
        value: input.value,
        data: input.data,
        operation: input.operation,
        safeTxGas: input.safeTxGas,
        gasPrice: input.gasPrice,
      }),
    });

    const payload = await response.json().catch(() => ({})) as GoPlusResponse;
    if (!response.ok || payload.error) {
      return failed(payload.error || `GoPlus returned HTTP ${response.status}.`);
    }

    const result = payload.result;
    if (!result?.is_simulated) {
      return failed(result?.simulate_failed_reason || payload.message || "GoPlus could not simulate this transaction.");
    }

    const balanceDeltas = parseBalanceDeltas(input, enrichment, result);
    const reverted = result.is_revert === true;
    return {
      provider: "goplus",
      status: reverted ? "reverted" : "success",
      balanceDeltas,
      gasUsed: normalizeQuantity(result.used_gas),
      flagged: result.flagged,
      revertReason: reverted ? result.revert_reason || "The simulated call reverted." : undefined,
      advisory: payload.advisory,
      note: reverted
        ? "The call reverted against current blockchain state."
        : "The call succeeded against current blockchain state. This is not an execution guarantee.",
    };
  } catch (cause) {
    return failed(cause instanceof Error ? cause.message : "GoPlus simulation failed.");
  }
}

function parseBalanceDeltas(
  input: SafeTxInput,
  enrichment: SafeTxEnrichment,
  result: NonNullable<GoPlusResponse["result"]>,
): TransactionSimulation["balanceDeltas"] {
  const safe = input.safeAddress.toLowerCase();
  const chain = getSupportedChain(input.chainId);
  const deltas: TransactionSimulation["balanceDeltas"] = [];

  for (const change of result.native_balance_changes ?? []) {
    if (change.address?.toLowerCase() !== safe) continue;
    const delta = parseSignedQuantity(change.change);
    if (delta === null || delta === 0n) continue;
    const before = parseSignedQuantity(change.before);
    const after = parseSignedQuantity(change.after);
    deltas.push({
      asset: chain.nativeCurrency.symbol,
      deltaRaw: delta.toString(),
      deltaFormatted: `${formatReadableUnits(delta.toString(), chain.nativeCurrency.decimals)} ${chain.nativeCurrency.symbol}`,
      beforeRaw: before?.toString(),
      afterRaw: after?.toString(),
    });
  }

  for (const accountChange of result.erc20_balance_changes ?? []) {
    if (accountChange.address?.toLowerCase() !== safe) continue;
    for (const tokenChange of accountChange.erc20_change ?? []) {
      if (!tokenChange.token_address) continue;
      const tokenAddress = tokenChange.token_address.toLowerCase() as Address;
      const delta = parseSignedQuantity(tokenChange.change);
      if (delta === null || delta === 0n) continue;
      const metadata = enrichment.tokenMetadata?.[tokenAddress];
      const symbol = metadata?.symbol ?? tokenAddress;
      deltas.push({
        asset: metadata?.name && metadata.name !== symbol ? `${metadata.name} (${symbol})` : symbol,
        tokenAddress,
        explorerUrl: `${chain.blockExplorerBaseUrl}/token/${tokenAddress}`,
        deltaRaw: delta.toString(),
        deltaFormatted: metadata
          ? `${formatReadableUnits(delta.toString(), metadata.decimals)} ${metadata.symbol}`
          : `${delta.toString()} raw units`,
      });
    }
  }

  return deltas;
}

function parseSignedQuantity(value: string | undefined): bigint | null {
  if (!value) return null;
  try {
    if (value.startsWith("-0x")) return -BigInt(`0x${value.slice(3)}`);
    return BigInt(value);
  } catch {
    return null;
  }
}

function normalizeQuantity(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    return BigInt(value).toString();
  } catch {
    return String(value);
  }
}

function failed(note: string): TransactionSimulation {
  return { provider: "goplus", status: "failed", balanceDeltas: [], note };
}
