import { HACKS } from "@/components/hacks/hacks-data";
import { docsSource } from "@/lib/docs/source";
import { HOME_FAQ } from "@/lib/seo/faq";
import { MAINNET_NAMES, TESTNET_NAMES } from "@/lib/seo/networks";
import { PUBLISHER_NAME, PUBLISHER_URL, SITE_NAME, absoluteUrl } from "@/lib/seo/site";

export const dynamic = "force-static";

/** llms.txt: a plain-text summary of the product for AI assistants and answer engines. */
export function GET() {
  const docs = docsSource
    .getPages()
    .map((page) => `- [${page.data.title}](${absoluteUrl(page.url)}): ${page.data.description ?? ""}`)
    .join("\n");

  const faq = HOME_FAQ.map((entry) => `### ${entry.question}\n\n${entry.answer}`).join("\n\n");

  const hacks = HACKS.map(
    (hack) => `- ${hack.name} (${hack.date}, ${hack.lossDisplay}): ${hack.vector}`,
  ).join("\n");

  const body = `# ${SITE_NAME}

> ${SITE_NAME} is a free, read-only security toolkit by ${PUBLISHER_NAME} for Safe (formerly Gnosis Safe) multisig wallets. It scans a Safe's on-chain configuration for risky settings and decodes Safe transactions so signers can verify the transaction hash before signing. It never connects a wallet, signs or submits transactions.

Publisher: ${PUBLISHER_NAME} (${PUBLISHER_URL})
License: MIT
Price: free, no account
Supported mainnets: ${MAINNET_NAMES.join(", ")}
Supported testnets: ${TESTNET_NAMES.join(", ")}

## Tools

- [Safe Inspector](${absoluteUrl("/")}): Reads owners, threshold, nonce, modules, guard, fallback handler, singleton and version over direct RPC. Reports severity ranked findings, a security score and configuration drift since the previous local scan. Exports Markdown and JSON.
- [Transaction Inspector](${absoluteUrl("/transaction-xray")}): Decodes Safe transaction calldata and MultiSend batches, recomputes the Safe transaction hash locally, scores risk, and can optionally run a current-state simulation.
- [Multisig hack timeline](${absoluteUrl("/hacks")}): Real multisig incidents with attack vectors and whether an independent review could have prevented each.

## Documentation

${docs}

## Frequently asked questions

${faq}

## Multisig incidents covered

${hacks}

## Limits

A clean report means no known configuration risk was detected. It does not prove that owners are the right people, that keys are stored safely, or that a transaction is authorized. It is not a substitute for a full security audit.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
