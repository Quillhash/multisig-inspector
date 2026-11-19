import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import {
  DEFAULT_DESCRIPTION,
  PUBLISHER_NAME,
  PUBLISHER_URL,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo/site";
import { pageMetadata } from "@/lib/seo/metadata";
import "./globals.css";

// Brand fonts, self-hosted so builds need no network: Bai Jamjuree for body
// and UI, Chakra Petch 700 for page and section titles only.
const baiJamjuree = localFont({
  variable: "--font-baijamjuree",
  display: "swap",
  src: [
    { path: "./fonts/bai-jamjuree-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/bai-jamjuree-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/bai-jamjuree-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/bai-jamjuree-700.woff2", weight: "700", style: "normal" },
  ],
});

const chakraPetch = localFont({
  variable: "--font-chakrapetch",
  display: "swap",
  src: [{ path: "./fonts/chakra-petch-700.woff2", weight: "700", style: "normal" }],
});

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  ...pageMetadata({
    title: `${SITE_NAME}: Free Safe Multisig Security Checker | ${PUBLISHER_NAME}`,
    description: DEFAULT_DESCRIPTION,
    path: "/",
  }),
  applicationName: SITE_NAME,
  keywords: [
    "Safe multisig security",
    "Gnosis Safe checker",
    "multisig inspector",
    "Safe transaction hash verification",
    "Safe transaction decoder",
    "multisig audit",
    "Safe wallet security",
    "verify Safe transaction before signing",
  ],
  authors: [{ name: PUBLISHER_NAME, url: PUBLISHER_URL }],
  creator: PUBLISHER_NAME,
  publisher: PUBLISHER_NAME,
  category: "security",
  formatDetection: { telephone: false, address: false, email: false },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F7F7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${baiJamjuree.variable} ${chakraPetch.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
