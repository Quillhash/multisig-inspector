import { HomeContent } from "@/components/home/home-content";
import { Providers } from "@/components/providers";
import { SafeInspectorApp } from "@/components/safe-inspector/safe-inspector-app";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { HOME_FAQ } from "@/lib/seo/faq";
import { faqSchema, howToSchema, webApplicationSchema } from "@/lib/seo/schema";

export default function Home() {
  return (
    <>
      <JsonLd data={[webApplicationSchema(), faqSchema(HOME_FAQ), howToSchema()]} />
      <Providers>
        <SafeInspectorApp>
          <HomeContent />
        </SafeInspectorApp>
      </Providers>
      <SiteFooter />
    </>
  );
}
