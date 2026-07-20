import type { Metadata } from "next";
import { Bai_Jamjuree } from "next/font/google";
import { Providers } from "@/components/providers";
import { DocsFloatingLink } from "@/components/docs-floating-link";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./globals.css";

const baiJamjuree = Bai_Jamjuree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bai-jamjuree",
});

export const metadata: Metadata = {
  title: "Multisig Inspector",
  description:
    "A local-first, read-only Gnosis Safe multisig auditor. Review configuration and verify transactions before signing.",
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
      className={`${baiJamjuree.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <RootProvider>
          <Providers>{children}</Providers>
        </RootProvider>
        <DocsFloatingLink />
      </body>
    </html>
  );
}
