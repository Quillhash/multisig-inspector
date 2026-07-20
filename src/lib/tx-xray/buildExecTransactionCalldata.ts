import { encodeFunctionData, type Hex } from "viem";
import { safeAbi } from "../safe/abi";
import type { SafeTxInput } from "./types";

export function buildExecTransactionCalldata(input: SafeTxInput, signatures: Hex): Hex {
  return encodeFunctionData({
    abi: safeAbi,
    functionName: "execTransaction",
    args: [
      input.to,
      BigInt(input.value),
      input.data,
      input.operation,
      BigInt(input.safeTxGas),
      BigInt(input.baseGas),
      BigInt(input.gasPrice),
      input.gasToken,
      input.refundReceiver,
      signatures,
    ],
  });
}
