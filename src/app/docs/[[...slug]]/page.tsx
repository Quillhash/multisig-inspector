import { getMDXComponents } from "@/components/mdx";
import { docsSource } from "@/lib/docs/source";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { JsonLd } from "@/components/site/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { articleSchema, breadcrumbSchema } from "@/lib/seo/schema";
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

  return pageMetadata({
    title: `${page.data.title} | Multisig Inspector Docs`,
    description: page.data.description ?? "Multisig Inspector documentation.",
    path: page.url,
    type: "article",
  });
}

export default async function DocumentationPage(
  props: { params: Promise<PageParams> },
) {
  const { slug } = await props.params;
  const page = docsSource.getPage(slug);
  if (!page) notFound();

  const Content = page.data.body;

  const crumbs = [
    { name: "Multisig Inspector", path: "/" },
    { name: "Docs", path: "/docs" },
  ];
  if (page.url !== "/docs") crumbs.push({ name: page.data.title, path: page.url });

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <JsonLd
        data={[
          articleSchema({
            title: page.data.title,
            description: page.data.description,
            path: page.url,
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Content components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
