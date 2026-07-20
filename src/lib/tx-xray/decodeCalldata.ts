import { decodeFunctionData, getAddress, maxUint256, parseAbiItem, type Hex } from "viem";
import { getKnownSafeComponents } from "../safeRegistry";
import { detectSafeAdminAction } from "./detectSafeAdminActions";
import { parseMultiSendItems } from "./decodeMultiSend";
import {
  accessControlAbi,
  erc20Abi,
  erc721Abi,
  erc1155Abi,
  permit2Abi,
  uniswapV2RouterAbi,
  uniswapV3RouterAbi,
} from "./abis";
import { extractSelector, labelSelector } from "./selectors";
import type { CallResolver, DecodedAction, SafeTxInput } from "./types";

/** MultiSend v1.3/1.4 selector — used to detect a batch even when the target is not the canonical MultiSend address. */
const MULTI_SEND_SELECTOR = "0x8d80ff0a";

/** OpenZeppelin AccessControl DEFAULT_ADMIN_ROLE is the all-zero bytes32. */
const DEFAULT_ADMIN_ROLE = `0x${"0".repeat(64)}`;

export function decodeCalldata(input: SafeTxInput, resolver?: CallResolver): DecodedAction[] {
  return decodeWithBudget(input, 0, { count: 0 }, resolver);
}

function decodeWithBudget(input: SafeTxInput, depth: number, budget: { count: number }, resolver?: CallResolver): DecodedAction[] {
  // A batch routed through the canonical MultiSend address, OR any address whose
  // calldata carries the multiSend selector. The canonical-address check stays
  // the primary path; the selector check is the fallback that catches a batch
  // routed through a wrapper or non-canonical deployment.
  const selector = extractSelector(input.data);
  const isMultiSend = isKnownMultiSend(input) || (selector === MULTI_SEND_SELECTOR && input.operation !== 1);

  if (isMultiSend) {
    if (depth >= 3 || budget.count >= 50) return [{ type: "unknown", title: "Partial batch decode", plainEnglish: "MultiSend safety limit reached; manual review is required.", technicalDetails: input.data, addressesInvolved: [input.to], selector }];
    try {
      const decoded = decodeFunctionData({ abi: [{ type: "function", name: "multiSend", inputs: [{ name: "transactions", type: "bytes" }] }], data: input.data });
      const packed = decoded.args?.[0] as Hex;
      const children: DecodedAction[] = [];
      for (const child of parseMultiSendItems(packed)) {
        if (budget.count >= 50) { children.push({ type: "unknown", title: "Partial batch decode", plainEnglish: "The 50-action decode limit was reached; remaining actions require manual review.", technicalDetails: packed, addressesInvolved: [] }); break; }
        budget.count += 1;
        children.push(...decodeWithBudget({ ...input, to: child.to, value: child.value, data: child.data, operation: child.operation }, depth + 1, budget, resolver));
      }
      return [{ type: "multi_send", title: "MultiSend batch", plainEnglish: `This batch contains ${children.length} decoded action${children.length === 1 ? "" : "s"}.`, technicalDetails: `Decoded at depth ${depth + 1}`, addressesInvolved: [input.to], selector, children }];
    } catch {
      return [{ type: "unknown_contract_call", title: "Malformed MultiSend batch", plainEnglish: "The batch could not be fully decoded.", technicalDetails: input.data, addressesInvolved: [input.to], selector }];
    }
  }

  if (input.operation === 1) return [{ type: "delegatecall", title: "DELEGATECALL", plainEnglish: "This executes external code in the Safe's context.", technicalDetails: `Target ${input.to}`, addressesInvolved: [input.to], selector }];

  const admin = detectSafeAdminAction(input.data);
  if (admin) return [admin];

  if (input.data === "0x" && BigInt(input.value) > 0n) return [{ type: "eth_transfer", title: "Native token transfer", plainEnglish: `Send ${input.value} raw native units to ${input.to}.`, technicalDetails: `CALL ${input.to} value=${input.value}`, addressesInvolved: [input.to], amountRaw: input.value }];

  // ERC-20 transfer / approve / transferFrom. This runs BEFORE the NFT decoder
  // because ERC-20 `transferFrom(address,address,uint256)` and ERC-721
  // `transferFrom(address,address,uint256)` share selector 0x23b872dd. ERC-20
  // is overwhelmingly more common in treasury flows, so it wins the collision;
  // a true NFT `transferFrom` will be reclassified later when the target is
  // known to be an ERC-721 collection (Layer-1 enrichment).
  try {
    const decoded = decodeFunctionData({ abi: erc20Abi, data: input.data });
    const args = decoded.args as readonly unknown[];
    const amount = args[args.length - 1] as bigint;
    const addresses = args.slice(0, -1) as SafeTxInput["to"][];
    const type = decoded.functionName === "transfer" ? "erc20_transfer" : decoded.functionName === "approve" ? "erc20_approve" : "erc20_transfer_from";
    const unlimited = decoded.functionName === "approve" && amount === maxUint256;
    return [{ type, title: decoded.functionName === "approve" ? "Token approval" : "Token transfer", plainEnglish: unlimited ? `Give ${addresses[0]} unlimited token allowance.` : `${decoded.functionName} ${amount} raw token units involving ${addresses.join(" and ")}.`, technicalDetails: `${decoded.functionName}(${args.join(", ")})`, addressesInvolved: addresses, tokenAddress: input.to, amountRaw: amount.toString(), selector }];
  } catch {
    // not an ERC-20 call; fall through
  }

  // Permit2 permit/permitTransferFrom — the most important blind spot, as this
  // is how several recent blind-signing drains moved funds out of a Safe.
  const permit2 = tryDecodePermit2(input.data);
  if (permit2) return [permit2];

  // ERC-721 / ERC-1155 transfers and approvals (selective selectors only — see
  // the ERC-20 note above for why transferFrom is not decoded here).
  const nft = tryDecodeNft(input.data);
  if (nft) return [nft];

  // Uniswap V2 / V3 swaps. Decoded only to a labelled swap action; the
  // simulation layer owns the real balance impact.
  const swap = tryDecodeSwap(input.data);
  if (swap) return [swap];

  // OpenZeppelin AccessControl role changes are admin/security-critical, so we
  // decode them fully instead of leaving them as "Unknown contract call".
  const accessControl = tryDecodeAccessControl(input, selector);
  if (accessControl) return [accessControl];

  if (input.data !== "0x") return unknownCall(input, selector, resolver);
  return [{ type: "unknown", title: "Empty transaction", plainEnglish: "This transaction has no value or calldata.", technicalDetails: "No action decoded", addressesInvolved: [input.to], selector }];
}

/** Canonical MultiSend detection (original behaviour). */
function isKnownMultiSend(input: SafeTxInput): boolean {
  return getKnownSafeComponents().some((component) => component.chainId === input.chainId && component.type === "library" && component.label.startsWith("MultiSend") && component.address === input.to.toLowerCase());
}

/**
 * Fallback for any non-empty calldata that did not match an explicit decoder.
 * Surfaces the 4-byte selector and a label (when the bundled map has one) so
 * the signer at least sees *which* function is being called.
 */
function unknownCall(input: SafeTxInput, selector: Hex | undefined, resolver?: CallResolver): DecodedAction[] {
  // Opt-in Layer-1 resolution: a verified contract ABI (exact) or a resolved
  // 4-byte signature (best-guess) turns "Unknown contract call" into something
  // readable without maintaining an ever-growing static selector list.
  const resolved = resolver ? tryResolvedDecode(input, selector, resolver) : null;
  if (resolved) return [resolved];

  const label = selector ? labelSelector(selector) : undefined;
  const selectorNote = selector ? ` Selector ${selector}${label ? ` (${label})` : ""}` : "";
  return [{
    type: "unknown_contract_call",
    title: label ? `Unrecognized call: ${label}` : "Unknown contract call",
    plainEnglish: label
      ? `Calls ${label} on ${input.to}. The arguments could not be decoded; manual review is required.`
      : `The calldata (selector ${selector ?? "unknown"}) is not recognized by the current decoder.`,
    technicalDetails: `${input.data}${selectorNote}`,
    addressesInvolved: [input.to],
    selector,
  }];
}

/** Shorten a hex value to `0x1234ab…cd34` for inline display. */
function shortenHex(hex: string, head = 8, tail = 4): string {
  if (typeof hex !== "string" || !hex.startsWith("0x") || hex.length <= head + tail + 2) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

/** Heuristic: a 0x + 64-char string is a bytes32; 0x + 40-char is an address. */
function looksLikeBytes32(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}
function looksLikeAddress(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Compact, human-readable rendering of a single decoded argument. */
function formatArgShort(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} ${pluralize("item", value.length)}`;
  if (looksLikeBytes32(value)) return shortenHex(value);
  if (looksLikeAddress(value)) {
    try { return shortenHex(getAddress(value)); } catch { return shortenHex(value); }
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.length > 24 ? shortenHex(value) : value;
  return String(value);
}

/** Full rendering for the technical details block (not the plain-English). */
function formatArgFull(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(formatArgFull).join(", ")}]`;
  if (looksLikeAddress(value)) {
    try { return getAddress(value); } catch { return value; }
  }
  if (typeof value === "bigint") return value.toString();
  return String(value);
}

function pluralize(noun: string, count: number): string {
  if (count === 1) return noun;
  return noun.endsWith("s") ? noun : `${noun}s`;
}

/**
 * Produce a human sentence for a resolved call by pattern-matching the function
 * name. Falls back to a generic "Calls <name>(<short args>) on <target>" when
 * no pattern matches. The disclaimer lives in `resolutionNote`, not here.
 */
function humanizeCall(fnName: string, args: readonly unknown[], target: Hex): string {
  const lower = fnName.toLowerCase();
  const shortArgs = args.map(formatArgShort);
  const targetShort = shortenHex(target);

  // grantRoles(bytes32[], address) / grantRole(bytes32, address) etc.
  const grantMatch = lower.match(/^grant(.+)$/);
  if (grantMatch) {
    const noun = grantMatch[1].toLowerCase();
    if (args.length >= 2 && Array.isArray(args[0]) && looksLikeAddress(args[1])) {
      return `Grants ${args[0].length} ${pluralize(noun, args[0].length)} to ${formatArgShort(args[1])} on ${targetShort}.`;
    }
    return `Grants ${noun} ${shortArgs.join(" to ")} on ${targetShort}.`;
  }
  const revokeMatch = lower.match(/^revoke(.+)$/);
  if (revokeMatch) {
    const noun = revokeMatch[1].toLowerCase();
    if (args.length >= 2 && Array.isArray(args[0]) && looksLikeAddress(args[1])) {
      return `Revokes ${args[0].length} ${pluralize(noun, args[0].length)} from ${formatArgShort(args[1])} on ${targetShort}.`;
    }
    return `Revokes ${noun} ${shortArgs.join(" from ")} on ${targetShort}.`;
  }
  const renounceMatch = lower.match(/^renounce(.+)$/);
  if (renounceMatch) {
    const noun = renounceMatch[1].toLowerCase();
    if (args.length >= 1 && Array.isArray(args[0])) {
      return `Renounces ${args[0].length} ${pluralize(noun, args[0].length)} on ${targetShort}.`;
    }
    return `Renounces ${noun} ${shortArgs.join(", ")} on ${targetShort}.`;
  }
  if (lower.startsWith("set")) {
    return `Sets ${shortArgs.join(" = ")} on ${targetShort}.`;
  }
  if (lower.startsWith("transfer")) {
    return `Transfers ${shortArgs.join(" → ")} on ${targetShort}.`;
  }
  if (lower.startsWith("approve")) {
    return `Approves ${shortArgs.join(" for ")} on ${targetShort}.`;
  }
  if (lower.startsWith("mint")) {
    return `Mints ${shortArgs.join(" to ")} on ${targetShort}.`;
  }
  if (lower.startsWith("burn")) {
    return `Burns ${shortArgs.join(" from ")} on ${targetShort}.`;
  }
  if (lower.startsWith("upgrade")) {
    return `Upgrades ${targetShort}${shortArgs.length ? ` (${shortArgs.join(", ")})` : ""}.`;
  }
  if (lower === "pause") return `Pauses ${targetShort}.`;
  if (lower === "unpause") return `Unpauses ${targetShort}.`;

  return `Calls ${fnName}(${shortArgs.join(", ")}) on ${targetShort}.`;
}

/**
 * Decode an otherwise-unknown call using an online-resolved verified ABI
 * (accurate) or a 4-byte signature (best-guess, may collide). Returns null when
 * nothing resolves so the caller falls back to the static label.
 */
function tryResolvedDecode(input: SafeTxInput, selector: Hex | undefined, resolver: CallResolver): DecodedAction | null {
  const abi = resolver.abis.get(input.to.toLowerCase());
  if (abi) {
    try {
      const decoded = decodeFunctionData({ abi, data: input.data });
      const args = (decoded.args ?? []) as readonly unknown[];
      return {
        type: "contract_call",
        title: `Call: ${decoded.functionName}`,
        plainEnglish: humanizeCall(decoded.functionName, args, input.to),
        technicalDetails: `${decoded.functionName}(${args.map(formatArgFull).join(", ")})`,
        addressesInvolved: [input.to],
        selector,
        resolutionNote: "verified-abi",
      };
    } catch {
      // ABI did not cover this selector; fall through to signature lookup.
    }
  }

  const signature = selector ? resolver.signatures.get(selector.toLowerCase()) : undefined;
  if (signature) {
    const fnName = signature.split("(")[0];
    try {
      const item = parseAbiItem(`function ${signature}`);
      const decoded = decodeFunctionData({ abi: [item], data: input.data });
      const args = (decoded.args ?? []) as readonly unknown[];
      return {
        type: "contract_call",
        title: `Call: ${fnName}`,
        plainEnglish: humanizeCall(fnName, args, input.to),
        technicalDetails: `${signature} => ${fnName}(${args.map(formatArgFull).join(", ")})`,
        addressesInvolved: [input.to],
        selector,
        resolutionNote: "unverified-signature",
      };
    } catch {
      // Signature name is known but arguments could not be decoded.
      return {
        type: "unknown_contract_call",
        title: `Unrecognized call: ${fnName}`,
        plainEnglish: `Calls ${signature} on ${shortenHex(input.to)}. The arguments could not be decoded; manual review is required.`,
        technicalDetails: `${input.data} (signature ${signature})`,
        addressesInvolved: [input.to],
        selector,
        resolutionNote: "unverified-signature",
      };
    }
  }

  return null;
}

function tryDecodeAccessControl(input: SafeTxInput, selector: Hex | undefined): DecodedAction | null {
  try {
    const decoded = decodeFunctionData({ abi: accessControlAbi, data: input.data });
    const [role, account] = decoded.args as unknown as [Hex, SafeTxInput["to"]];
    const roleLabel = role.toLowerCase() === DEFAULT_ADMIN_ROLE ? "DEFAULT_ADMIN_ROLE" : role;
    const plainEnglish =
      decoded.functionName === "grantRole"
        ? `Grant role ${roleLabel} to ${account} on ${input.to}.`
        : decoded.functionName === "revokeRole"
          ? `Revoke role ${roleLabel} from ${account} on ${input.to}.`
          : `${account} renounces role ${roleLabel} on ${input.to}.`;
    const title =
      decoded.functionName === "grantRole"
        ? "Access control: grant role"
        : decoded.functionName === "revokeRole"
          ? "Access control: revoke role"
          : "Access control: renounce role";
    return {
      type: "access_control",
      title,
      plainEnglish,
      technicalDetails: `${decoded.functionName}(role=${role}, account=${account})`,
      addressesInvolved: [account, input.to],
      selector,
    };
  } catch {
    return null;
  }
}

function tryDecodePermit2(data: Hex): DecodedAction | null {
  const selector = extractSelector(data);
  if (!selector) return null;
  try {
    const decoded = decodeFunctionData({ abi: permit2Abi, data });
    if (decoded.functionName === "permitTransferFrom") {
      const permit = decoded.args[0] as unknown as { permitted: { token: Hex; amount: bigint }; nonce: bigint; deadline: bigint };
      const transferDetails = decoded.args[1] as unknown as { to: Hex; requestedAmount: bigint };
      const owner = decoded.args[2] as unknown as Hex;
      return {
        type: "permit2_transfer",
        title: "Permit2 signed transfer",
        plainEnglish: `Move ${permit.permitted.amount} raw units of token ${permit.permitted.token} from ${owner} to ${transferDetails.to} using a stored Permit2 signature.`,
        technicalDetails: `permitTransferFrom(token=${permit.permitted.token}, amount=${permit.permitted.amount}, to=${transferDetails.to}, owner=${owner})`,
        addressesInvolved: [owner, transferDetails.to, permit.permitted.token],
        tokenAddress: permit.permitted.token,
        amountRaw: permit.permitted.amount.toString(),
        selector,
      };
    }
    if (decoded.functionName === "permit") {
      const owner = decoded.args[0] as unknown as Hex;
      const batch = decoded.args[1] as unknown as { details: Array<{ token: Hex; amount: bigint }>; spender: Hex; sigDeadline: bigint };
      const tokens = [...new Set(batch.details.map((detail) => detail.token))];
      return {
        type: "permit2_permit",
        title: "Permit2 approval",
        plainEnglish: `Grant ${batch.spender} token spending allowance on Permit2 for ${tokens.length} token(s), authorized by ${owner}'s signature.`,
        technicalDetails: `permit(owner=${owner}, spender=${batch.spender}, tokens=${tokens.join(",")}, sigDeadline=${batch.sigDeadline})`,
        addressesInvolved: [owner, batch.spender, ...tokens],
        selector,
      };
    }
  } catch {
    // not a Permit2 call
  }
  return null;
}

function tryDecodeNft(data: Hex): DecodedAction | null {
  const selector = extractSelector(data);
  if (!selector) return null;
  try {
    const decoded = decodeFunctionData({ abi: erc721Abi, data });
    const args = decoded.args as readonly unknown[];
    if (decoded.functionName === "setApprovalForAll") {
      const operator = args[0] as Hex;
      const approved = args[1] as boolean;
      return { type: "erc721_approve_all", title: "NFT blanket approval", plainEnglish: `${approved ? "Grant" : "Revoke"} operator ${operator} control over every NFT in this collection.`, technicalDetails: `setApprovalForAll(${operator}, ${approved})`, addressesInvolved: [operator], selector };
    }
    // safeTransferFrom / transferFrom — (from, to, tokenId[, data])
    const from = args[0] as Hex;
    const to = args[1] as Hex;
    const tokenId = args[2] as bigint;
    return { type: "erc721_transfer", title: "NFT transfer", plainEnglish: `Transfer NFT #${tokenId} from ${from} to ${to}.`, technicalDetails: `${decoded.functionName}(${args.join(", ")})`, addressesInvolved: [from, to], amountRaw: tokenId.toString(), selector };
  } catch {
    // not an ERC-721 call; try ERC-1155
  }
  try {
    const decoded = decodeFunctionData({ abi: erc1155Abi, data });
    const args = decoded.args as readonly unknown[];
    if (decoded.functionName === "setApprovalForAll") {
      const operator = args[0] as Hex;
      const approved = args[1] as boolean;
      return { type: "erc721_approve_all", title: "ERC-1155 blanket approval", plainEnglish: `${approved ? "Grant" : "Revoke"} operator ${operator} control over every ERC-1155 token in this collection.`, technicalDetails: `setApprovalForAll(${operator}, ${approved})`, addressesInvolved: [operator], selector };
    }
    if (decoded.functionName === "safeBatchTransferFrom") {
      const from = args[0] as Hex;
      const to = args[1] as Hex;
      const ids = args[2] as readonly bigint[];
      const amounts = args[3] as readonly bigint[];
      return { type: "erc1155_transfer", title: "ERC-1155 batch transfer", plainEnglish: `Transfer ${ids.length} ERC-1155 token type(s) from ${from} to ${to}.`, technicalDetails: `safeBatchTransferFrom(from=${from}, to=${to}, ids=${ids.join(",")}, amounts=${amounts.join(",")})`, addressesInvolved: [from, to], selector };
    }
    // safeTransferFrom — (from, to, id, amount, data)
    const from = args[0] as Hex;
    const to = args[1] as Hex;
    const id = args[2] as bigint;
    const amount = args[3] as bigint;
    return { type: "erc1155_transfer", title: "ERC-1155 transfer", plainEnglish: `Transfer ${amount} of ERC-1155 token id ${id} from ${from} to ${to}.`, technicalDetails: `safeTransferFrom(from=${from}, to=${to}, id=${id}, amount=${amount})`, addressesInvolved: [from, to], amountRaw: amount.toString(), selector };
  } catch {
    return null;
  }
}

function tryDecodeSwap(data: Hex): DecodedAction | null {
  const selector = extractSelector(data);
  if (!selector) return null;
  for (const abi of [uniswapV2RouterAbi, uniswapV3RouterAbi]) {
    try {
      const decoded = decodeFunctionData({ abi, data });
      const recipients = collectAddresses(decoded.args);
      const venue = abi === uniswapV2RouterAbi ? "Uniswap V2" : "Uniswap V3";
      return {
        type: "swap",
        title: `${venue} swap`,
        plainEnglish: `Executes ${decoded.functionName} on a ${venue} router. Final token amounts depend on pool state and are not decoded here.`,
        technicalDetails: `${venue}.${decoded.functionName}(...)`,
        addressesInvolved: recipients,
        selector,
      };
    } catch {
      // try the next ABI
    }
  }
  // The selector may still be a known swap selector on a forked router we do
  // not have an ABI for — surface the label so the signer is not blind.
  const label = labelSelector(selector);
  if (label && (label.includes("Uniswap") || label.includes("swap"))) {
    return { type: "swap", title: label, plainEnglish: `Calls ${label}. Arguments not decoded; review the router address and simulation output.`, technicalDetails: data, addressesInvolved: [], selector };
  }
  return null;
}

function collectAddresses(value: unknown): Hex[] {
  if (value == null) return [];
  if (typeof value === "string" && value.startsWith("0x") && value.length === 42) return [value as Hex];
  if (Array.isArray(value)) return value.flatMap((item) => collectAddresses(item));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap((item) => collectAddresses(item));
  return [];
}
