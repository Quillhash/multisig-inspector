import { getAddress, type Address, type Hex } from "viem";

export type MultiSendItem = { operation: 0 | 1; to: Address; value: string; data: Hex };

export function parseMultiSendItems(packed: Hex): MultiSendItem[] {
  const body = packed.slice(2);
  const items: MultiSendItem[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    if (body.length - cursor < 170) throw new Error("Malformed MultiSend item header.");
    const operation = Number.parseInt(body.slice(cursor, cursor + 2), 16);
    if (operation !== 0 && operation !== 1) throw new Error("Unsupported MultiSend operation.");
    cursor += 2;
    const to = getAddress(`0x${body.slice(cursor, cursor + 40)}`);
    cursor += 40;
    const value = BigInt(`0x${body.slice(cursor, cursor + 64)}`).toString();
    cursor += 64;
    const dataLength = Number(BigInt(`0x${body.slice(cursor, cursor + 64)}`));
    cursor += 64;
    const dataEnd = cursor + dataLength * 2;
    if (!Number.isSafeInteger(dataLength) || dataEnd > body.length) throw new Error("Malformed MultiSend calldata length.");
    const data = `0x${body.slice(cursor, dataEnd)}` as Hex;
    cursor = dataEnd;
    items.push({ operation, to, value, data });
  }
  return items;
}
