import Link from "next/link";
import { PUBLISHER_NAME, PUBLISHER_URL, SITE_NAME } from "@/lib/seo/site";

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
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-6">
        <div>
          <p className="text-base font-semibold tracking-tight">{SITE_NAME}</p>
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">
            A free, read-only toolkit for reviewing Safe multisig configuration
            and transactions before signing.
          </p>
          <p className="mt-4 text-sm text-muted">
            Built by{" "}
            <a
              href={PUBLISHER_URL}
              target="_blank"
              rel="noopener"
              className="font-semibold text-foreground underline decoration-rule-strong underline-offset-4 hover:decoration-accent"
            >
              {PUBLISHER_NAME}
            </a>
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-xs font-semibold tracking-[0.08em] text-muted-faint uppercase">
              {column.title}
            </p>
            <ul className="mt-3 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-rule">
        <p className="mx-auto max-w-[1200px] px-5 py-5 text-xs leading-relaxed text-muted-faint lg:px-6">
          Read-only analysis. Multisig Inspector never connects a wallet, signs
          or submits transactions. A clean result is not a guarantee of safety.
          Released under the MIT license.
        </p>
      </div>
    </footer>
  );
}
