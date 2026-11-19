import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { TransactionXRayApp } from "@/components/transaction-xray/transaction-xray-app";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema } from "@/lib/seo/schema";

export const metadata: Metadata = pageMetadata({
  title: "Safe Transaction Decoder and Hash Verifier | Multisig Inspector",
  description:
    "Decode a Safe (Gnosis Safe) transaction, including MultiSend batches, and recompute its Safe transaction hash locally. Verify what you are signing before you approve it.",
  path: "/transaction-xray",
});

export default function TransactionXRayPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Multisig Inspector", path: "/" },
          { name: "Transaction Inspector", path: "/transaction-xray" },
        ])}
      />
      <TransactionXRayApp />
      <SiteFooter />
    </>
  );
}
