import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default async function TerminosPage() {
  const content = await prisma.legalContent.findUnique({ where: { key: "terms" } });

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16">
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">
          {content?.title ?? "Términos y Condiciones"}
        </h1>
        <p className="text-brand-ink-soft whitespace-pre-line">
          {content?.body ?? "Contenido pendiente."}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
