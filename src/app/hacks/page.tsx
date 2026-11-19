import type { Metadata } from "next";
import { HACKS } from "@/components/hacks/hacks-data";
import { HacksPage } from "@/components/hacks/hacks-page";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema } from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";

const title = "Multisig Hack Timeline: Bybit, Radiant and More | Multisig Inspector";
const description =
  "A timeline of major multisig wallet hacks, how each attack worked, and whether independent transaction decoding, hash verification or a Safe configuration scan could have prevented it.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/hacks", type: "article" });

export default function HacksRoute() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Multisig Inspector", path: "/" },
            { name: "Multisig hack timeline", path: "/hacks" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Multisig hack timeline",
            description,
            url: absoluteUrl("/hacks"),
            numberOfItems: HACKS.length,
            itemListElement: HACKS.map((hack, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: `${hack.name} (${hack.date}): ${hack.lossDisplay}`,
              description: hack.vector,
            })),
          },
        ]}
      />
      <HacksPage />
      <SiteFooter />
    </>
  );
}
