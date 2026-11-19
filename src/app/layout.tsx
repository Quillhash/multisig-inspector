import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  DEFAULT_DESCRIPTION,
  PUBLISHER_NAME,
  PUBLISHER_URL,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo/site";
import { pageMetadata } from "@/lib/seo/metadata";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
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
  themeColor: "#070b18",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
