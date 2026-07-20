import type { ReactNode } from "react";
import { docsLayoutOptions } from "@/lib/docs/layout";
import { docsSource } from "@/lib/docs/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import "./docs.css";

export default function DocumentationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-theme">
      <DocsLayout tree={docsSource.getPageTree()} {...docsLayoutOptions()}>
        {children}
      </DocsLayout>
    </div>
  );
}
