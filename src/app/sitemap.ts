import type { MetadataRoute } from "next";
import { docsSource } from "@/lib/docs/source";
import { absoluteUrl } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const tools: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/transaction-xray"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/hacks"), changeFrequency: "monthly", priority: 0.8 },
  ];

  const docs: MetadataRoute.Sitemap = docsSource.getPages().map((page) => ({
    url: absoluteUrl(page.url),
    changeFrequency: "monthly",
    priority: page.url === "/docs" ? 0.7 : 0.6,
  }));

  return [...tools, ...docs];
}
