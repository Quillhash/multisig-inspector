export type FriendlyScanError = {
  title: string;
  message: string;
  help?: string;
};

export function formatScanError(
  error: unknown,
  networkName?: string,
): FriendlyScanError {
  const message = getErrorMessage(error);

  if (message.includes("Enter a valid EVM address")) {
    return {
      title: "Invalid address",
      message: "Enter a valid 0x EVM address and try again.",
      help: "Example format: 0x1234...abcd",
    };
  }

  if (message.includes("implementation contract")) {
    return {
      title: "This is a Safe implementation contract, not a Safe",
      message:
        "You entered an official Safe singleton or library address. These are the reference contracts that Safe proxies delegate to — they are not wallets and cannot be scanned as a Safe.",
      help: "Paste the Safe proxy address (the one created by your Safe setup) instead.",
    };
  }

  if (
    message.includes("returned no data") ||
    message.includes("does not have the function") ||
    message.includes("address is not a contract")
  ) {
    return {
      title: "This does not look like a supported Safe",
      message: `The address exists${networkName ? ` on ${networkName}` : ""}, but it did not respond like a Safe multisig.`,
      help: "Check that the address is the Safe proxy address, not an owner, token, module, or another smart account type.",
    };
  }

  if (
    message.includes("Failed to fetch") ||
    message.includes("HTTP request failed") ||
    message.includes("fetch failed") ||
    message.includes("NetworkError")
  ) {
    return {
      title: "Network request failed",
      message: "The scanner could not reach the RPC endpoint for this network.",
      help: "Try again in a moment, or switch networks and scan again.",
    };
  }

  return {
    title: "Scan failed",
    message: "The scanner could not read this Safe configuration.",
    help: "Check the address and network, then try again.",
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}
