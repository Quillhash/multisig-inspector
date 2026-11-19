import type { FaqEntry } from "./faq";
import {
  DEFAULT_DESCRIPTION,
  PUBLISHER_NAME,
  PUBLISHER_URL,
  SITE_NAME,
  absoluteUrl,
} from "./site";

const publisher = {
  "@type": "Organization",
  "@id": `${PUBLISHER_URL}/#organization`,
  name: PUBLISHER_NAME,
  url: PUBLISHER_URL,
};

export function webApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${absoluteUrl("/")}#app`,
    name: SITE_NAME,
    alternateName: ["QuillAudits Multisig Inspector", "Safe Inspector"],
    url: absoluteUrl("/"),
    description: DEFAULT_DESCRIPTION,
    applicationCategory: "SecurityApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    license: "https://opensource.org/licenses/MIT",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Safe multisig configuration scan over direct RPC",
      "Owner, threshold, module, guard, fallback handler and singleton checks",
      "Configuration drift detection between scans",
      "Safe transaction calldata and MultiSend decoding",
      "Local Safe transaction hash recomputation",
      "Markdown and JSON report export",
    ],
    publisher,
    creator: publisher,
  };
}

export function faqSchema(entries: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

export function howToSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to check a Safe multisig configuration",
    description:
      "Scan a Safe (Gnosis Safe) multisig for risky configuration with Multisig Inspector.",
    totalTime: "PT1M",
    tool: [{ "@type": "HowToTool", name: SITE_NAME }],
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Paste a Safe address or URL",
        text: "Open Safe Inspector and paste the Safe address, an eth:0x… prefixed address, or a Safe app or block explorer URL. The network is auto-detected on supported mainnets.",
        url: absoluteUrl("/"),
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Confirm the owners",
        text: "Review the list of signer addresses read from the chain and confirm whether each one is expected.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Read and export the report",
        text: "Review the security score and findings, then export the report as Markdown or JSON.",
      },
    ],
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function articleSchema({
  title,
  description,
  path,
}: {
  title: string;
  description?: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
    author: publisher,
    publisher,
  };
}
