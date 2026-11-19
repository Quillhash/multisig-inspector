"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { id: "scan", label: "Safe Inspector", href: "/" },
  { id: "xray", label: "Transaction Inspector", href: "/transaction-xray" },
  { id: "hacks", label: "Hacks", href: "/hacks" },
  { id: "docs", label: "Docs", href: "/docs" },
] as const;

const AUDIT_URL = "https://www.quillaudits.com/opsec-and-multisig-audit";

/** Floating frosted pill nav, as on quillaudits.com. */
export function SiteHeader({ active = "scan" }: { active?: "scan" | "xray" | "hacks" }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <a href="#main" className="qa-skip qa-btn qa-btn--sm">
        Skip to content
      </a>
      <header className="qa-nav">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Multisig Inspector by QuillAudits, home">
          <Image
            src="/branding/quillaudits-logo.svg"
            alt="QuillAudits"
            width={148}
            height={24}
            className="block h-6 w-auto shrink-0"
            priority
          />
          <span className="hidden truncate border-l border-rule pl-3 text-sm font-semibold text-foreground min-[420px]:block">
            Multisig Inspector
          </span>
        </Link>

        <nav aria-label="Main navigation">
          <ul className="qa-nav__links">
            {navLinks.map((link) => (
              <li key={link.id}>
                <Link
                  href={link.href}
                  aria-current={active === link.id ? "page" : undefined}
                  className="qa-nav__link"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <a href={AUDIT_URL} target="_blank" rel="noopener" className="qa-btn qa-btn--sm">
          Get an audit
        </a>

        <button
          type="button"
          className="qa-nav__menu"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
        </button>
      </header>

      {menuOpen ? (
        <nav id="mobile-nav" className="qa-nav__sheet" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={active === link.id ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className="qa-nav__link"
            >
              {link.label}
            </Link>
          ))}
          <a href={AUDIT_URL} target="_blank" rel="noopener" className="qa-btn qa-btn--sm mt-2">
            Get an audit
          </a>
        </nav>
      ) : null}
    </>
  );
}
