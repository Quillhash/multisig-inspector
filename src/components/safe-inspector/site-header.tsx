"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navLinks = [
  { id: "scan", label: "Safe Inspector", href: "/" },
  { id: "xray", label: "Transaction Inspector", href: "/transaction-xray" },
  { id: "hacks", label: "Hacks", href: "/hacks" },
] as const;

export function SiteHeader({ active = "scan" }: { active?: "scan" | "xray" | "hacks" }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-surface">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Multisig Inspector home">
            <LogoMark />
            <span className="text-[1rem] leading-none font-semibold tracking-tight text-foreground">
              Multisig Inspector
            </span>
          </Link>
          <a
            href="https://www.quillaudits.com"
            target="_blank"
            rel="noopener"
            className="hidden items-center gap-1.5 border-l border-rule pl-2.5 opacity-80 transition hover:opacity-100 min-[420px]:inline-flex"
          >
            <span className="text-xs leading-none text-muted-faint">by</span>
            <Image
              src="/branding/quillaudits-logo.svg"
              alt="QuillAudits"
              width={100}
              height={16}
              className="block h-[15px] w-auto"
              priority
            />
          </a>
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={active === link.id ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                active === link.id
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-background hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/docs"
            className="inline-flex h-9 items-center gap-1 rounded-full border border-rule-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Docs
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-faint" aria-hidden="true" />
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rule text-foreground md:hidden"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="absolute top-full right-0 left-0 border-b border-rule bg-surface shadow-[var(--shadow-pop)] md:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto max-w-[1200px] px-5 pt-2 pb-4">
            {[...navLinks, { id: "docs", label: "Docs", href: "/docs" } as const].map((link) => (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block rounded-lg px-3 py-3 text-sm font-medium",
                  active === link.id
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-background hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#103DD3" />
      <circle cx="14" cy="14" r="6.5" stroke="#fff" strokeWidth="2.5" />
      <path d="M18.5 18.5L24.5 24.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
