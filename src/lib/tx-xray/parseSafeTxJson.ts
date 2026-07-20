import { getMultiSendCallOnlyDeployment } from "@safe-global/safe-deployments";
import {
  concatHex,
  encodeFunctionData,
  encodePacked,
  getAddress,
  isAddress,
  isHex,
  size,
  type AbiFunction,
  type AbiParameter,
  type Address,
  type Hex,
} from "viem";
import { normalizeSafeTx } from "./normalizeSafeTx";

type JsonFallbacks = {
  chainId?: number;
  safeAddress?: string;
  nonce?: string;
};

type BatchTransaction = {
  to: string;
  value: string;
  data?: string;
  contractMethod?: {
    inputs?: AbiParameter[];
    name?: string;
    payable?: boolean;
  };
  contractInputsValues?: Record<string, string>;
};

type SafeBatchFile = {
  chainId?: unknown;
  meta?: { createdFromSafeAddress?: unknown };
  transactions: unknown[];
};

export function parseSafeTxJson(json: string, fallbacks: JsonFallbacks | number = {}) {
  const value = parseJsonObject(json);
  const normalizedFallbacks = typeof fallbacks === "number" ? { chainId: fallbacks } : fallbacks;

  if (Array.isArray(value.transactions)) {
    return parseSafeBatch(value as SafeBatchFile, normalizedFallbacks);
  }

  return normalizeSafeTx({
    ...value,
    source: "json",
    safeAddress: value.safeAddress ?? value.safe ?? normalizedFallbacks.safeAddress,
    chainId: value.chainId ?? normalizedFallbacks.chainId,
    to: value.to,
    value: value.value,
    data: value.data ?? "0x",
    operation: value.operation,
    nonce: value.nonce ?? normalizedFallbacks.nonce,
    providedSafeTxHash: value.providedSafeTxHash ?? value.safeTxHash,
  });
}

function parseSafeBatch(batch: SafeBatchFile, fallbacks: JsonFallbacks) {
  const chainId = positiveInteger(batch.chainId ?? fallbacks.chainId, "chainId");
  const safeAddress = validAddress(
    batch.meta?.createdFromSafeAddress ?? fallbacks.safeAddress,
    "Safe address",
  );
  const nonce = unsignedInteger(fallbacks.nonce, "Safe nonce");

  if (batch.transactions.length === 0) {
    throw new Error("Safe Transaction Builder JSON contains no transactions.");
  }
  if (batch.transactions.length > 50) {
    throw new Error("Safe Transaction Builder JSON exceeds the 50-transaction verification limit.");
  }

  const transactions = batch.transactions.map((transaction, index) =>
    parseBatchTransaction(transaction, index),
  );

  if (transactions.length === 1) {
    const transaction = transactions[0];
    return normalizeSafeTx({
      source: "json",
      safeAddress,
      chainId,
      nonce,
      operation: 0,
      ...transaction,
    });
  }

  const deployment = getMultiSendCallOnlyDeployment({
    network: String(chainId),
    released: true,
  });
  if (!deployment) {
    throw new Error("Safe MultiSendCallOnly is not available on this network.");
  }

  const packed = concatHex(
    transactions.map((transaction) =>
      encodePacked(
        ["uint8", "address", "uint256", "uint256", "bytes"],
        [0, transaction.to, BigInt(transaction.value), BigInt(size(transaction.data)), transaction.data],
      ),
    ),
  );
  const data = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "multiSend",
        stateMutability: "payable",
        inputs: [{ name: "transactions", type: "bytes" }],
        outputs: [],
      },
    ],
    functionName: "multiSend",
    args: [packed],
  });

  return normalizeSafeTx({
    source: "json",
    safeAddress,
    chainId,
    to: deployment.defaultAddress,
    value: "0",
    data,
    operation: 1,
    nonce,
  });
}

function parseBatchTransaction(value: unknown, index: number): {
  to: Address;
  value: string;
  data: Hex;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Transaction ${index + 1} is malformed.`);
  }
  const transaction = value as BatchTransaction;
  const to = validAddress(transaction.to, `Transaction ${index + 1} target`);
  const amount = unsignedInteger(transaction.value, `Transaction ${index + 1} value`);
  const data = transaction.data ?? encodeContractCall(transaction, index);
  if (!isHex(data)) {
    throw new Error(`Transaction ${index + 1} data must be 0x-prefixed calldata.`);
  }
  return { to, value: amount, data };
}

function encodeContractCall(transaction: BatchTransaction, index: number): Hex {
  const method = transaction.contractMethod;
  if (!method?.name) return "0x";
  const inputs = method.inputs ?? [];
  const values = transaction.contractInputsValues ?? {};
  const args = inputs.map((input, inputIndex) => {
    const key = input.name || String(inputIndex);
    const raw = values[key];
    if (typeof raw !== "string") {
      throw new Error(`Transaction ${index + 1} is missing contract input ${key}.`);
    }
    return parseAbiValue(input, raw);
  });
  const abi: AbiFunction = {
    type: "function",
    name: method.name,
    stateMutability: method.payable ? "payable" : "nonpayable",
    inputs,
    outputs: [],
  };
  try {
    return encodeFunctionData({ abi: [abi], functionName: method.name, args });
  } catch {
    throw new Error(`Transaction ${index + 1} contract inputs could not be encoded.`);
  }
}

function parseAbiValue(parameter: AbiParameter, raw: unknown): unknown {
  const arrayMatch = parameter.type.match(/^(.*)(\[[0-9]*\])$/);
  if (arrayMatch) {
    const values = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
    if (!Array.isArray(values)) throw new Error("Array input must be JSON.");
    return values.map((value) =>
      parseAbiValue({ ...parameter, type: arrayMatch[1] as AbiParameter["type"] }, value),
    );
  }
  if (parameter.type === "tuple") {
    const value = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
    const components: readonly AbiParameter[] = "components" in parameter
      ? parameter.components
      : [];
    if (Array.isArray(value)) {
      return components.map((component, index) => parseAbiValue(component, value[index]));
    }
    if (!value || typeof value !== "object") throw new Error("Tuple input must be JSON.");
    const record = value as Record<string, unknown>;
    return components.map((component, index) =>
      parseAbiValue(component, record[component.name || String(index)]),
    );
  }
  if (/^u?int[0-9]*$/.test(parameter.type)) return BigInt(String(raw));
  if (parameter.type === "bool") {
    if (raw === true || raw === "true") return true;
    if (raw === false || raw === "false") return false;
    throw new Error("Boolean input must be true or false.");
  }
  return String(raw);
}

function parseJsonObject(json: string): Record<string, unknown> {
  try {
    const value = JSON.parse(normalizeJsonFormattingWhitespace(json)) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error("Transaction JSON is not valid JSON.");
  }
}

function normalizeJsonFormattingWhitespace(json: string): string {
  let normalized = "";
  let insideString = false;
  let escaped = false;

  for (const character of json) {
    if (insideString) {
      normalized += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        insideString = false;
      }
      continue;
    }

    if (character === '"') {
      insideString = true;
      normalized += character;
      continue;
    }

    normalized += /[\u00a0\u2007\u202f\ufeff]/u.test(character) ? " " : character;
  }

  return normalized;
}

function validAddress(value: unknown, label: string): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${label} must be a valid address.`);
  }
  return getAddress(value);
}

function positiveInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be selected.`);
  return parsed;
}

function unsignedInteger(value: unknown, label: string): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`${label} is required for a Transaction Builder export.`);
  }
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be an unsigned integer.`);
  return BigInt(text).toString();
}
