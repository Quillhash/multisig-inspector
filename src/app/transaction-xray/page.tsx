import type { Metadata } from "next";
import { TransactionXRayApp } from "@/components/transaction-xray/transaction-xray-app";

export const metadata: Metadata = { title: "Transaction Inspector | Multisig Inspector", description: "Locally decode and review a Safe transaction before signing." };
export default function TransactionXRayPage() { return <TransactionXRayApp />; }
