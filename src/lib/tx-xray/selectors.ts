import { getFunctionSelector } from "viem";
import type { Hex } from "viem";

/**
 * Bundled 4-byte function-selector labels. Used as the Layer-0 fallback when a
 * contract call does not match any of the explicit ABIs in `decodeCalldata` —
 * so an unknown action still tells the signer which function is being called
 * instead of the generic "Unknown contract call".
 *
 * Curated from high-traffic DeFi contracts a treasury Safe is likely to touch.
 * Entries are keyed by the 0x-prefixed 4-byte selector. This is manually
 * maintained (see plan: Layer-0 is a versioned static list); Layer-1 could
 * later resolve selectors via a live directory.
 */
const SELECTOR_LABELS: Record<string, string> = {
  // --- Uniswap V2 router ---
  "0x18cbafe5": "Uniswap V2 swapExactTokensForETH",
  "0x38ed1739": "Uniswap V2 swapTokensForExactTokens",
  "0x8803dbee": "Uniswap V2 swapTokensForExactETH",
  "0x7ff36ab5": "Uniswap V2 swapExactETHForTokens",
  "0x8c8b7c39": "Uniswap V2 swapExactTokensForTokens",
  "0xfb3bdb41": "Uniswap V2 swapETHForExactTokens",
  "0x5c11d795": "Uniswap V2 swapExactTokensForTokensSupportingFeeOnTransferTokens",
  "0x791ac947": "Uniswap V2 swapExactTokensForETHSupportingFeeOnTransferTokens",
  "0xb6f9de95": "Uniswap V2 swapExactETHForTokensSupportingFeeOnTransferTokens",
  // --- Uniswap V3 / SwapRouter ---
  "0x414bf389": "Uniswap V3 exactInputSingle",
  "0xc04b8d59": "Uniswap V3 exactInput",
  "0xf28c0498": "Uniswap V3 exactOutputSingle",
  "0xdb3e2198": "Uniswap V3 exactOutput",
  "0x5ae401dc": "Uniswap V3 multicall",
  "0xac9650d8": "Uniswap V3 multicall (bytes[])",
  // --- Permit2 (Uniswap) ---
  "0x2b67b570": "Permit2 permit",
  "0x36c78516": "Permit2 permitTransferFrom",
  "0x37aee5c2": "Permit2 permitTransferFrom (batch)",
  "0xd6c57c3d": "Permit2 permitWitnessTransferFrom",
  // --- ERC-20 extras ---
  "0x095ea7b3": "ERC20 approve",
  "0xa9059cbb": "ERC20 transfer",
  "0x23b872dd": "ERC20 transferFrom",
  "0x70a08231": "ERC20 balanceOf",
  "0xdd62ed3e": "ERC20 allowance",
  // --- ERC-721 ---
  "0x42842e0e": "ERC721 safeTransferFrom",
  "0xb88d4fde": "ERC721 safeTransferFrom (bytes)",
  "0xe985e9c5": "ERC721 setApprovalForAll",
  "0x081812fc": "ERC721 approve",
  // --- ERC-1155 ---
  "0xf242432a": "ERC1155 safeTransferFrom",
  "0x2eb2c2d6": "ERC1155 safeBatchTransferFrom",
  "0xa22cb465": "ERC1155 setApprovalForAll",
  // --- Aave V3 pool ---
  "0x617ba037": "Aave V3 supply",
  "0x69328dec": "Aave V3 withdraw",
  "0x573ade81": "Aave V3 repay",
  "0xa415bcad": "Aave V3 borrow",
  // --- Curve ---
  "0x3df02124": "Curve exchange",
  "0x5e5db586": "Curve exchange_underlying",
  "0xe95a739e": "Curve add_liquidity",
  "0x5b2f1d02": "Curve remove_liquidity",
  // --- Lido / Rocket Pool ---
  "0xa1903eab": "Lido submit",
  "0x960fcf29": "Rocket Pool deposit",
  // --- Access control / roles (grant/revoke/renounce decoded explicitly) ---
  "0x2f2ff15d": "AccessControl grantRole",
  "0xd547741f": "AccessControl revokeRole",
  "0x36568abe": "AccessControl renounceRole",
  "0x1e4e0091": "AccessControl setRoleAdmin",
  // --- Ownable / proxy admin ---
  "0xf2fde38b": "Ownable transferOwnership",
  "0x715018a6": "Ownable renounceOwnership",
  "0x3659cfe6": "Proxy upgradeTo",
  "0x4f1ef286": "Proxy upgradeToAndCall",
  // --- Pausable / supply ---
  "0x8456cb59": "Pausable pause",
  "0x3f4ba83a": "Pausable unpause",
  "0x40c10f19": "mint(address,uint256)",
  "0x9dc29fac": "burn(address,uint256)",
  // --- Safe admin (decoded explicitly, listed for completeness) ---
  "0x0d582f13": "Safe addOwnerWithThreshold",
  "0xf8dc5dd9": "Safe removeOwner",
  "0x831fb946": "Safe swapOwner",
  "0x694e80c3": "Safe changeThreshold",
  "0x7de7edef": "Safe enableModule",
  "0xe318b52b": "Safe disableModule",
  "0xe19a9dd9": "Safe setGuard",
  "0xf08a0323": "Safe setFallbackHandler",
};

/**
 * Look up a human label for a calldata selector. Returns undefined when no
 * bundled match exists — callers should surface the raw selector in that case.
 */
export function labelSelector(selector: string): string | undefined {
  return SELECTOR_LABELS[selector.toLowerCase()];
}

/**
 * Extract the 0x-prefixed 4-byte selector from calldata. Returns undefined for
 * calldata shorter than 4 bytes (e.g. bare `0x` or receive-fallback stubs).
 */
export function extractSelector(data: Hex): Hex | undefined {
  if (data.length < 10) return undefined;
  return `${data.slice(0, 10).toLowerCase()}` as Hex;
}

/**
 * Compute a selector from a human function signature, e.g.
 * `selectorFromSignature("transfer(address,uint256)")` -> "0xa9059cbb".
 * Exported for tests so the bundled map can be validated against source ABIs.
 */
export function selectorFromSignature(signature: string): Hex {
  return getFunctionSelector(signature) as Hex;
}
