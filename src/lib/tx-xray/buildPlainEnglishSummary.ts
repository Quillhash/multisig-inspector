import type { DecodedAction, SafeTxHashCheck, XRayResult } from "./types";

export function buildSummary(actions: DecodedAction[]) { return actions.map((action) => action.plainEnglish); }
export function recommendation(level: XRayResult["riskLevel"], hashStatus?: SafeTxHashCheck["status"]) {
  if (hashStatus === "mismatch") return "Hash verification failed. Do not sign until the transaction details are confirmed.";
  if (level === "critical") return "Do not sign. This transaction can change Safe control.";
  if (level === "high") return "Do not sign until reviewed by a trusted technical reviewer.";
  if (level === "medium") return "Manual review recommended before signing.";
  return "Looks like a normal transfer. Verify recipient and amount out-of-band before signing.";
}
