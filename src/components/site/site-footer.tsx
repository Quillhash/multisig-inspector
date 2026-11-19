import Image from "next/image";
import Link from "next/link";
import { PUBLISHER_URL } from "@/lib/seo/site";

const columns = [
  {
    title: "Tools",
    links: [
      { label: "Safe Inspector", href: "/" },
      { label: "Transaction Inspector", href: "/transaction-xray" },
      { label: "Multisig hack timeline", href: "/hacks" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Getting started", href: "/docs/getting-started" },
      { label: "Verify the Safe transaction hash", href: "/docs/verify-the-hash" },
      { label: "Security and trust model", href: "/docs/security-model" },
      { label: "Signer operating routine", href: "/docs/operating-routine" },
    ],
  },
  {
    title: "Reference",
    links: [
      { label: "Networks and privacy", href: "/docs/networks-and-privacy" },
      { label: "Troubleshooting", href: "/docs/troubleshooting" },
      { label: "FAQ", href: "/docs/faq" },
      { label: "Glossary", href: "/docs/glossary" },
    ],
  },
  {
    title: "QuillAudits",
    links: [
      { label: "QuillAudits home", href: PUBLISHER_URL },
      { label: "OPSEC and Multisig Audit", href: `${PUBLISHER_URL}/opsec-and-multisig-audit` },
      { label: "Smart Contract Audit", href: `${PUBLISHER_URL}/smart-contract-audit` },
      { label: "Brand kit", href: `${PUBLISHER_URL}/brandkit` },
    ],
  },
] as const;

/** Reduced QuillAudits footer slab for the standalone tool. */
export function SiteFooter() {
  return (
    <footer className="qa-panel qa-footer mt-2 mb-2">
      <div className="qa-footer__top">
        <a href={PUBLISHER_URL} aria-label="QuillAudits">
          <Image src="/branding/quillaudits-logo.svg" alt="QuillAudits" width={148} height={24} />
        </a>
        <p className="qa-small max-w-[44ch] text-right max-sm:hidden">
          Multisig Inspector is a free, read-only tool by QuillAudits.
        </p>
      </div>
      <div className="qa-footer__cols">
        {columns.map((column) => (
          <nav key={column.title} className="qa-footer__col" aria-label={column.title}>
            <p className="qa-footer__title">{column.title}</p>
            <ul>
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("http") ? (
                    <a href={link.href} className="qa-footer__link">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="qa-footer__link">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="qa-footer__bottom">
        Read-only analysis. Multisig Inspector never connects a wallet, signs or
        submits transactions. A clean result is not a guarantee of safety.
        Released under the MIT license. © QuillAudits.
      </p>
    </footer>
  );
}
