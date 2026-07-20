import { parseAbi } from "viem";

/**
 * Consolidated human-readable ABIs for the contracts the X-Ray decoder
 * recognizes. Previously these were inlined in `decodeCalldata.ts`; they are
 * centralized here so the decoder, the selector map, and tests reference one
 * source of truth.
 */

export const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
]);

export const multiSendAbi = parseAbi(["function multiSend(bytes transactions)"]);

/**
 * OpenZeppelin AccessControl role management. These are admin/security-critical
 * for treasury Safes (they change who can call privileged functions on a
 * contract), so we decode them fully in Layer-0 rather than falling through to
 * "Unknown contract call".
 */
export const accessControlAbi = parseAbi([
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function renounceRole(bytes32 role, address account)",
]);

export const safeAdminAbi = parseAbi([
  "function addOwnerWithThreshold(address owner, uint256 threshold)",
  "function removeOwner(address prevOwner, address owner, uint256 threshold)",
  "function swapOwner(address prevOwner, address oldOwner, address newOwner)",
  "function changeThreshold(uint256 threshold)",
  "function enableModule(address module)",
  "function disableModule(address prevModule, address module)",
  "function setGuard(address guard)",
  "function setFallbackHandler(address handler)",
]);

export const erc721Abi = parseAbi([
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
]);

export const erc1155Abi = parseAbi([
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
  "function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)",
  "function setApprovalForAll(address operator, bool approved)",
]);

/**
 * Permit2 signatures carry a nested `PermitTransferFrom` struct; viem's
 * `parseAbi` supports tuple syntax. Used to decode the common Permit2
 * transfer-permit flow that underpins several recent blind-signing drains.
 */
export const permit2Abi = [
  {
    type: "function",
    name: "permitTransferFrom",
    inputs: [
      { name: "permit", type: "tuple", components: [
        { name: "permitted", type: "tuple", components: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ], internalType: "struct ISignatureTransfer.TokenPermissions" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ], internalType: "struct ISignatureTransfer.PermitTransferFrom" },
      { name: "transferDetails", type: "tuple", components: [
        { name: "to", type: "address" },
        { name: "requestedAmount", type: "uint256" },
      ], internalType: "struct ISignatureTransfer.SignatureTransferDetails" },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "permit",
    inputs: [
      { name: "owner", type: "address" },
      { name: "permitBatch", type: "tuple", components: [
        { name: "details", type: "tuple[]", components: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint160" },
          { name: "expiration", type: "uint48" },
          { name: "nonce", type: "uint48" },
        ], internalType: "struct IAllowanceTransfer.PermitDetails[]" },
        { name: "spender", type: "address" },
        { name: "sigDeadline", type: "uint256" },
      ], internalType: "struct IAllowanceTransfer.PermitBatch" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Uniswap V2/V3 router selectors are decoded only to surface a labelled swap
 * action. We do not attempt to fully reconstruct path/amount-out semantics —
 * the simulation layer (Layer-1) is responsible for the real balance impact.
 */
export const uniswapV2RouterAbi = parseAbi([
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)",
  "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)",
  "function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] path, address to, uint deadline)",
  "function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] path, address to, uint deadline)",
  "function swapETHForExactTokens(uint amountOut, address[] path, address to, uint deadline)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] path, address to, uint deadline)",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)",
]);

export const uniswapV3RouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params)",
  "function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params)",
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountOutMaximum, uint160 sqrtPriceLimitX96) params)",
  "function exactOutput((bytes path, address recipient, uint256 amountOut, uint256 amountOutMaximum) params)",
]);
