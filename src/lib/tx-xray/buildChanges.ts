import { getSupportedChain } from "../chains/chains";
import { formatReadableUnits } from "./formatActionAmounts";
import type { DecodedAction, SafeConfigChanges, SafeTxEnrichment, SafeTxInput } from "./types";

export function buildChanges(actions: DecodedAction[], enrichment: SafeTxEnrichment | undefined, input: SafeTxInput, simulation?: import("./types").TransactionSimulation): SafeConfigChanges {
  const current = enrichment?.currentConfig;
  const changes: SafeConfigChanges = { owners: { added: [], removed: [] }, modules: { added: [], removed: [] }, balances: [] };

  // GoPlus supplies the simulated delta. Combine it with balances independently
  // fetched through RPC so the UI can show current -> projected state.
  if (simulation && simulation.status === "success" && simulation.balanceDeltas.length > 0) {
    changes.balances = simulation.balanceDeltas.map((delta) => simulationBalanceChange(delta, enrichment, input));
  } else {
    changes.balances = buildBalanceChanges(actions, enrichment, input);
  }

  for (const action of actions) {
    const effect = action.adminEffect;
    if (!effect) continue;
    if (effect.kind === "add_owner") { changes.owners.added.push(effect.owner); changes.threshold = { before: current?.threshold, after: effect.threshold }; }
    if (effect.kind === "remove_owner") { changes.owners.removed.push(effect.owner); changes.threshold = { before: current?.threshold, after: effect.threshold }; }
    if (effect.kind === "swap_owner") { changes.owners.removed.push(effect.oldOwner); changes.owners.added.push(effect.newOwner); }
    if (effect.kind === "change_threshold") changes.threshold = { before: current?.threshold, after: effect.threshold };
    if (effect.kind === "enable_module") changes.modules.added.push(effect.module);
    if (effect.kind === "disable_module") changes.modules.removed.push(effect.module);
    if (effect.kind === "set_guard") changes.guard = { before: current?.guard ?? null, after: effect.guard };
    if (effect.kind === "set_fallback") changes.fallbackHandler = { before: current?.fallbackHandler ?? null, after: effect.handler };
  }
  return changes;
}

function simulationBalanceChange(
  delta: import("./types").TransactionSimulation["balanceDeltas"][number],
  enrichment: SafeTxEnrichment | undefined,
  input: SafeTxInput,
): SafeConfigChanges["balances"][number] {
  const chain = getSupportedChain(input.chainId);
  const metadata = delta.tokenAddress ? enrichment?.tokenMetadata?.[delta.tokenAddress.toLowerCase()] : undefined;
  const rpcBefore = delta.tokenAddress
    ? enrichment?.assetBalances?.tokens[delta.tokenAddress.toLowerCase()]
    : enrichment?.assetBalances?.native;
  const beforeRaw = delta.beforeRaw ?? rpcBefore;
  const afterRaw = delta.afterRaw ?? (beforeRaw === undefined ? undefined : (BigInt(beforeRaw) + BigInt(delta.deltaRaw)).toString());
  const decimals = metadata?.decimals ?? (delta.tokenAddress ? undefined : chain.nativeCurrency.decimals);
  const symbol = metadata?.symbol ?? (delta.tokenAddress ? undefined : chain.nativeCurrency.symbol);

  if (beforeRaw !== undefined && afterRaw !== undefined && BigInt(afterRaw) < 0n) {
    const shortfall = (-BigInt(afterRaw)).toString();
    const before = decimals !== undefined && symbol
      ? `${formatReadableUnits(beforeRaw, decimals)} ${symbol}`
      : `${beforeRaw} raw units`;
    const missing = decimals !== undefined && symbol
      ? `${formatReadableUnits(shortfall, decimals)} ${symbol}`
      : `${shortfall} raw units`;
    return {
      asset: delta.asset,
      tokenAddress: delta.tokenAddress,
      explorerUrl: delta.explorerUrl,
      beforeRaw,
      afterRaw: "unknown",
      beforeFormatted: `Reported current balance: ${before}`,
      afterFormatted: `Projection unavailable: reported outflow exceeds that balance by ${missing}`,
    };
  }

  return {
    asset: delta.asset,
    tokenAddress: delta.tokenAddress,
    explorerUrl: delta.explorerUrl,
    beforeRaw: beforeRaw ?? "unknown",
    afterRaw: afterRaw ?? "unknown",
    beforeFormatted: beforeRaw !== undefined && decimals !== undefined && symbol
      ? `${formatReadableUnits(beforeRaw, decimals)} ${symbol}`
      : beforeRaw !== undefined ? `${beforeRaw} raw units` : "Unknown",
    afterFormatted: afterRaw !== undefined && decimals !== undefined && symbol
      ? `${formatReadableUnits(afterRaw, decimals)} ${symbol}`
      : afterRaw !== undefined ? `${afterRaw} raw units` : `Change ${delta.deltaFormatted}`,
  };
}

function buildBalanceChanges(actions: DecodedAction[], enrichment: SafeTxEnrichment | undefined, input: SafeTxInput): SafeConfigChanges["balances"] {
  if (!enrichment?.assetBalances) return [];
  const chain = getSupportedChain(input.chainId);
  const safe = input.safeAddress.toLowerCase();
  let nativeDelta = 0n;
  const tokenDeltas = new Map<string, bigint>();

  for (const action of actions) {
    const amount = action.amountRaw ? BigInt(action.amountRaw) : 0n;
    if (action.type === "eth_transfer" && action.addressesInvolved[0]?.toLowerCase() !== safe) nativeDelta -= amount;
    if (!action.tokenAddress || amount === 0n) continue;
    const key = action.tokenAddress.toLowerCase();
    let delta = tokenDeltas.get(key) ?? 0n;
    if (action.type === "erc20_transfer" && action.addressesInvolved[0]?.toLowerCase() !== safe) delta -= amount;
    if (action.type === "erc20_transfer_from") {
      if (action.addressesInvolved[0]?.toLowerCase() === safe) delta -= amount;
      if (action.addressesInvolved[1]?.toLowerCase() === safe) delta += amount;
    }
    tokenDeltas.set(key, delta);
  }

  const balances: SafeConfigChanges["balances"] = [];
  if (nativeDelta !== 0n && enrichment.assetBalances.native !== undefined) {
    const before = BigInt(enrichment.assetBalances.native);
    const after = before + nativeDelta;
    if (after < 0n) {
      const symbol = chain.nativeCurrency.symbol;
      balances.push({
        asset: symbol,
        beforeRaw: before.toString(),
        afterRaw: "unknown",
        beforeFormatted: `Reported current balance: ${formatReadableUnits(before.toString(), chain.nativeCurrency.decimals)} ${symbol}`,
        afterFormatted: `Projection unavailable: reported outflow exceeds that balance by ${formatReadableUnits((-after).toString(), chain.nativeCurrency.decimals)} ${symbol}`,
      });
    } else {
      balances.push({
        asset: chain.nativeCurrency.symbol,
        beforeRaw: before.toString(),
        afterRaw: after.toString(),
        beforeFormatted: `${formatReadableUnits(before.toString(), chain.nativeCurrency.decimals)} ${chain.nativeCurrency.symbol}`,
        afterFormatted: `${formatReadableUnits(after.toString(), chain.nativeCurrency.decimals)} ${chain.nativeCurrency.symbol}`,
      });
    }
  }

  for (const [tokenKey, delta] of tokenDeltas) {
    const balance = enrichment.assetBalances.tokens[tokenKey];
    if (delta === 0n || balance === undefined) continue;
    const before = BigInt(balance);
    const after = before + delta;
    const metadata = enrichment.tokenMetadata?.[tokenKey];
    const tokenAddress = tokenKey as SafeTxInput["to"];
    const asset = metadata ? `${metadata.name ?? metadata.symbol}${metadata.name && metadata.name !== metadata.symbol ? ` (${metadata.symbol})` : ""}` : tokenAddress;
    if (after < 0n) {
      const beforeFormatted = metadata ? `${formatReadableUnits(before.toString(), metadata.decimals)} ${metadata.symbol}` : `${before} raw units`;
      const shortfall = metadata ? `${formatReadableUnits((-after).toString(), metadata.decimals)} ${metadata.symbol}` : `${-after} raw units`;
      balances.push({
        asset,
        tokenAddress,
        explorerUrl: `${chain.blockExplorerBaseUrl}/token/${tokenAddress}`,
        beforeRaw: before.toString(),
        afterRaw: "unknown",
        beforeFormatted: `Reported current balance: ${beforeFormatted}`,
        afterFormatted: `Projection unavailable: reported outflow exceeds that balance by ${shortfall}`,
      });
      continue;
    }
    balances.push({
      asset,
      tokenAddress,
      explorerUrl: `${chain.blockExplorerBaseUrl}/token/${tokenAddress}`,
      beforeRaw: before.toString(),
      afterRaw: after.toString(),
      beforeFormatted: metadata ? `${formatReadableUnits(before.toString(), metadata.decimals)} ${metadata.symbol}` : `${before} raw units`,
      afterFormatted: metadata ? `${formatReadableUnits(after.toString(), metadata.decimals)} ${metadata.symbol}` : `${after} raw units`,
    });
  }
  return balances;
}
