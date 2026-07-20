import { decodeFunctionData, type Address, type Hex } from "viem";
import { safeAdminAbi } from "./abis";
import { extractSelector } from "./selectors";
import type { DecodedAction } from "./types";

export function detectSafeAdminAction(data: Hex): DecodedAction | null {
  const selector = extractSelector(data);
  try {
    const decoded = decodeFunctionData({ abi: safeAdminAbi, data });
    const args = decoded.args as readonly unknown[];
    let effect: DecodedAction["adminEffect"];
    let text: string = decoded.functionName;
    if (decoded.functionName === "addOwnerWithThreshold") { effect = { kind: "add_owner", owner: args[0] as Address, threshold: Number(args[1]) }; text = `Add owner ${args[0]} and set threshold to ${args[1]}`; }
    else if (decoded.functionName === "removeOwner") effect = { kind: "remove_owner", owner: args[1] as Address, threshold: Number(args[2]) };
    else if (decoded.functionName === "swapOwner") effect = { kind: "swap_owner", oldOwner: args[1] as Address, newOwner: args[2] as Address };
    else if (decoded.functionName === "changeThreshold") effect = { kind: "change_threshold", threshold: Number(args[0]) };
    else if (decoded.functionName === "enableModule") effect = { kind: "enable_module", module: args[0] as Address };
    else if (decoded.functionName === "disableModule") effect = { kind: "disable_module", module: args[1] as Address };
    else if (decoded.functionName === "setGuard") effect = { kind: "set_guard", guard: args[0] as Address };
    else if (decoded.functionName === "setFallbackHandler") effect = { kind: "set_fallback", handler: args[0] as Address };
    if (!effect) return null;
    const addresses = args.filter((value): value is Address => typeof value === "string" && value.startsWith("0x") && value.length === 42);
    return { type: "safe_admin", title: "Safe administration change", plainEnglish: text, technicalDetails: `${decoded.functionName}(${args.join(", ")})`, addressesInvolved: addresses, adminEffect: effect, selector };
  } catch { return null; }
}
