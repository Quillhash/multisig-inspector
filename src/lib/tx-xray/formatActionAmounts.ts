import { formatUnits } from "viem";
import { getSupportedChain } from "../chains/chains";
import type { DecodedAction, SafeTxEnrichment, SafeTxInput, TokenMetadata } from "./types";

const MAX_DISPLAY_DECIMALS = 8;

export function formatActionAmounts(
  actions: DecodedAction[],
  input: SafeTxInput,
  enrichment: SafeTxEnrichment,
): DecodedAction[] {
  const chain = getSupportedChain(input.chainId);
  return actions.map((action) => {
    // Reclassify ERC-20 transferFrom as ERC-721 transfer when enrichment
    // confirms the target implements ERC-721. The selector 0x23b872dd is
    // shared between ERC-20 and ERC-721 transferFrom; the decoder defaults
    // to ERC-20 (more common in treasury flows) and we correct it here.
    if (action.type === "erc20_transfer_from" && action.tokenAddress && enrichment.erc721Contracts?.has(action.tokenAddress.toLowerCase())) {
      const from = action.addressesInvolved[0];
      const to = action.addressesInvolved[1];
      action = {
        ...action,
        type: "erc721_transfer",
        title: "NFT transfer",
        plainEnglish: `Transfer NFT #${action.amountRaw} from ${from} to ${to}.`,
        technicalDetails: `transferFrom(${from}, ${to}, ${action.amountRaw})`,
      };
    }
    return formatAction(action, chain.nativeCurrency, chain.blockExplorerBaseUrl, enrichment);
  });
}

function formatAction(
  action: DecodedAction,
  nativeCurrency: { decimals: number; symbol: string },
  blockExplorerBaseUrl: string,
  enrichment: SafeTxEnrichment,
): DecodedAction {
  const children = action.children?.map((child) => formatAction(child, nativeCurrency, blockExplorerBaseUrl, enrichment));
  if (!action.amountRaw) return { ...action, ...(children ? { children } : {}) };

  if (action.type === "eth_transfer") {
    const amountFormatted = `${formatReadableUnits(action.amountRaw, nativeCurrency.decimals)} ${nativeCurrency.symbol}`;
    const recipient = action.addressesInvolved[0];
    return {
      ...action,
      amountFormatted,
      plainEnglish: `Transfer ${amountFormatted} to ${recipient}.`,
      technicalDetails: `${action.technicalDetails}; amount ${amountFormatted} (raw: ${action.amountRaw})`,
      ...(children ? { children } : {}),
    };
  }

  if (!action.tokenAddress) return { ...action, ...(children ? { children } : {}) };
  const metadata = enrichment.tokenMetadata?.[action.tokenAddress.toLowerCase()];
  if (!metadata) return { ...rawTokenWording(action), ...(children ? { children } : {}) };

  const amountFormatted = `${formatReadableUnits(action.amountRaw, metadata.decimals)} ${metadata.symbol}`;
  return {
    ...action,
    amountFormatted,
    tokenName: metadata.name ?? metadata.symbol,
    tokenExplorerUrl: `${blockExplorerBaseUrl}/token/${action.tokenAddress}`,
    plainEnglish: tokenWording(action, amountFormatted, metadata),
    technicalDetails: `${action.technicalDetails}; amount ${amountFormatted} (raw: ${action.amountRaw})`,
    ...(children ? { children } : {}),
  };
}

function tokenWording(action: DecodedAction, amount: string, metadata: TokenMetadata) {
  if (action.type === "erc20_transfer_from") return `Transfer ${amount} from ${action.addressesInvolved[0]} to ${action.addressesInvolved[1]}.`;
  if (action.type === "erc20_approve") return `Approve ${action.addressesInvolved[0]} to spend ${amount}.`;
  if (action.type === "erc20_transfer") return `Transfer ${amount} to ${action.addressesInvolved[0]}.`;
  return `${amount} ${metadata.symbol}`;
}

function rawTokenWording(action: DecodedAction): DecodedAction {
  const token = action.tokenAddress;
  const raw = action.amountRaw;
  const plainEnglish = action.type === "erc20_transfer_from"
    ? `Transfer ${raw} raw units of token ${token} from ${action.addressesInvolved[0]} to ${action.addressesInvolved[1]}.`
    : action.type === "erc20_approve"
      ? `Approve ${action.addressesInvolved[0]} to spend ${raw} raw units of token ${token}.`
      : `Transfer ${raw} raw units of token ${token} to ${action.addressesInvolved[0]}.`;
  return { ...action, plainEnglish, technicalDetails: `${action.technicalDetails}; raw amount: ${raw}` };
}

export function formatReadableUnits(raw: string, decimals: number) {
  const [whole, fractional = ""] = formatUnits(BigInt(raw), decimals).split(".");
  const significantFraction = fractional.replace(/0+$/, "");
  if (!significantFraction) return whole;
  if (significantFraction.length <= MAX_DISPLAY_DECIMALS) return `${whole}.${significantFraction}`;
  return `${whole}.${significantFraction.slice(0, MAX_DISPLAY_DECIMALS)}…`;
}
