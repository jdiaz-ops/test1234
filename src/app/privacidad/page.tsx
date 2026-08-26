import { prisma } from "@/lib/prisma";

export default async function PrivacidadPage() {
  const content = await prisma.legalContent.findUnique({ where: { key: "privacy" } });

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">
        {content?.title ?? "Política de Privacidad"}
      </h1>
      <p className="text-brand-ink-soft whitespace-pre-line">
        {content?.body ?? "Contenido pendiente."}
      </p>
    </div>
  );
}
