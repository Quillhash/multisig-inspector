import { getMDXComponents } from "@/components/mdx";
import { docsSource } from "@/lib/docs/source";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type PageParams = { slug?: string[] };

export function generateStaticParams() {
  return docsSource.generateParams();
}

export async function generateMetadata(
  props: { params: Promise<PageParams> },
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  return {
    title: `${page.data.title} | Multisig Inspector Docs`,
    description: page.data.description,
  };
}

export default async function DocumentationPage(
  props: { params: Promise<PageParams> },
) {
  const { slug } = await props.params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  const Content = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Content components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
