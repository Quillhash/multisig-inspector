import type { MetadataRoute } from "next";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Multisig Inspector",
    description: DEFAULT_DESCRIPTION,
    start_url: ".",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#070b18",
    icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
