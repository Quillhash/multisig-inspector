"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function SiteHeader({ active = "scan" }: { active?: "scan" | "xray" | "hacks" }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { id: "scan", label: "Safe Inspector", href: "/" },
    { id: "xray", label: "Transaction Inspector", href: "/transaction-xray" },
    { id: "hacks", label: "Hacks", href: "/hacks" },
  ] as const;

  const mobileOnlyLinks = [
    { id: "docs", label: "Docs", href: "/docs", external: true },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/70 shadow-[0_1px_0_rgba(16,61,211,0.06),0_12px_36px_rgba(16,61,211,0.05)] backdrop-blur-xl">
      <div className="mx-auto flex h-[3.75rem] max-w-[1320px] items-center justify-between gap-4 px-5 lg:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link href="/" className="text-[1rem] leading-none font-bold tracking-tight text-foreground">
              Multisig Inspector
            </Link>
            <span className="flex items-center gap-1.5">
              <span className="text-[0.75rem] leading-none font-medium text-muted-faint">
                by
              </span>
              <Link
                href="https://www.quillaudits.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center opacity-90 transition hover:opacity-100"
              >
                <Image
                  src="/branding/quillaudits-logo.svg"
                  alt="QuillAudits"
                  width={100}
                  height={16}
                  className="block h-4 w-auto translate-y-px"
                  priority
                />
              </Link>
            </span>
          </div>
        </div>

        <nav
          className="hidden items-center gap-1 sm:flex"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <NavLink key={link.id} href={link.href} active={active === link.id}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center divide-x divide-rule border border-rule md:flex">
          <TrustFact label="RPC" value="Direct" />
          <TrustFact label="Persistence" value="None" />
          <TrustFact label="Signing" value="Never" />
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rule bg-surface text-foreground shadow-sm sm:hidden"
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
          className="absolute left-0 right-0 top-full border-b border-white/60 bg-white/95 shadow-lg backdrop-blur-xl sm:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto max-w-[1320px] px-5 pb-4 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block rounded-lg px-3 py-3 text-sm font-semibold",
                  active === link.id
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
            {mobileOnlyLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-3 text-sm font-semibold text-muted hover:bg-surface hover:text-foreground"
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

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      className={cn(
        "px-3 py-2 text-sm font-semibold",
        active
          ? "border-b-2 border-accent text-accent"
          : "text-muted hover:text-foreground",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

function TrustFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 text-center">
      <div className="text-[0.625rem] font-semibold tracking-[0.08em] text-muted-faint uppercase">
        {label}
      </div>
      <div className="text-[0.75rem] font-bold text-foreground">{value}</div>
    </div>
  );
}
