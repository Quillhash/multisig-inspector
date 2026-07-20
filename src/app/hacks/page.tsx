import type { Metadata } from "next";
import { HacksPage } from "@/components/hacks/hacks-page";

export const metadata: Metadata = {
  title: "Multisig Hack Timeline | Multisig Inspector",
  description:
    "Timeline of recent multisig hacks and how independent decoding, hash verification, and Safe configuration scanning could have prevented them.",
};

export default function HacksRoute() {
  return <HacksPage />;
}
