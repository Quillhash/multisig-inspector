import type { MetadataRoute } from "next";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Multisig Inspector",
    description: DEFAULT_DESCRIPTION,
    start_url: ".",
    display: "standalone",
    background_color: "#F7F7F7",
    theme_color: "#103DD3",
    icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
