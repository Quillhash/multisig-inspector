/**
 * Single source of truth for canonical URLs and brand strings.
 *
 * NEXT_PUBLIC_SITE_URL must be the public URL the app is served from, without a
 * trailing slash. It may include a path prefix when the app is mounted under
 * one. The marketing page at www.quillaudits.com/multisig-inspector is a
 * separate app; this tool is served from its own subdomain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://multisiginspector.quillaudits.com"
).replace(/\/+$/, "");

export const SITE_NAME = "Multisig Inspector";
export const PUBLISHER_NAME = "QuillAudits";
export const PUBLISHER_URL = "https://www.quillaudits.com";

export const DEFAULT_DESCRIPTION =
  "Free, read-only Safe (Gnosis Safe) multisig security checker. Scan owners, threshold, modules and guards, decode transactions and verify the Safe transaction hash before you sign. No wallet connection.";

/** Absolute URL for an app-relative path such as "/hacks". */
export function absoluteUrl(path = "/"): string {
  const clean = path === "/" ? "" : `/${path.replace(/^\/+/, "")}`;
  return `${SITE_URL}${clean}`;
}
