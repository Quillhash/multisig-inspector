import type { Metadata } from "next";
import { SITE_NAME, absoluteUrl } from "./site";

/** Per-page metadata with canonical URL, Open Graph and Twitter cards filled in. */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl("/og");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: "@QuillAudits",
      images: [image],
    },
  };
}
