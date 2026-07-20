"use client";

import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

export function DocsFloatingLink() {
  const pathname = usePathname();

  if (pathname.startsWith("/docs")) {
    return null;
  }

  return (
    <a
      href="/docs"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open documentation in a new tab"
      className="group fixed right-4 bottom-4 z-50 hidden h-9 max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-full border border-white/15 bg-[#171717] px-3.5 text-[0.72rem] font-semibold tracking-[-0.01em] text-white shadow-[0_3px_10px_rgba(15,23,42,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_7px_20px_rgba(15,23,42,0.17)] focus-visible:ring-4 focus-visible:ring-black/15 focus-visible:outline-none sm:inline-flex sm:right-7 sm:bottom-7 sm:shadow-[0_7px_20px_rgba(15,23,42,0.17)]"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#8b7cff] shadow-[0_0_0_2px_rgba(139,124,255,0.13)]" aria-hidden="true" />
      <span>Docs</span>
      <ArrowUpRight className="h-3 w-3 text-white/65 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" aria-hidden="true" />
    </a>
  );
}
