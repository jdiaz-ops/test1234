import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { getPublicStorePage, listStorefrontMenuItems } from "@/server/services/store-page-service";
import { StoreHeader } from "@/components/storefront/store-header";
import { getStoreBasePath } from "@/lib/store-base-path";

/// Política de tratamiento de datos personales de la tienda (Ley 1581 de
/// 2012), enlazada desde la casilla de autorización del checkout. Si la
/// marca creó su propia página en Mi tienda → Páginas con el título
/// "Política de privacidad" (o "Política de tratamiento de datos"), se usa
/// esa. Si no, se muestra esta política por defecto con los datos de la
/// marca, para que ninguna tienda quede sin una. Ver conversación del
/// 2026-10-01.
const OWN_PAGE_SLUGS = ["politica-de-privacidad", "politica-de-tratamiento-de-datos"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) return {};
  return { title: `Política de privacidad — ${brand.companyName}` };
}

export default async function StorePrivacyPolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const basePath = await getStoreBasePath(slug);
  for (const pageSlug of OWN_PAGE_SLUGS) {
    const own = await getPublicStorePage(brand.id, pageSlug);
    if (own) redirect(`${basePath}/pagina/${own.slug}`);
  }

  const [menuItems, owner] = await Promise.all([
    listStorefrontMenuItems(brand.id),
    prisma.user.findUnique({ where: { id: brand.userId }, select: { email: true } }),
  ]);
  const responsible = brand.legalName?.trim() || brand.companyName;
  const contactEmail = owner?.email ?? null;

  return (
    <div className="min-h-screen bg-brand-bg">
      <StoreHeader
        brandSlug={slug}
        brandName={brand.companyName}
        logoUrl={brand.logoUrl}
        basePath={basePath}
        menuItems={menuItems}
      />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
          Política de tratamiento de datos personales
        </h1>
        <div className="rich-text-content text-sm text-brand-ink space-y-4">
          <p>
            <strong>{responsible}</strong>
            {brand.taxId ? `, identificada con NIT ${brand.taxId},` : ""} es responsable del tratamiento de los
            datos personales que recibe a través de esta tienda, conforme a la Ley 1581 de 2012 y el Decreto 1377
            de 2013.
          </p>

          <h2>Qué datos recogemos</h2>
          <p>
            Tu nombre, correo, teléfono y, cuando compras productos físicos, tu dirección, ciudad y departamento de
            envío. También guardamos el detalle de tus pedidos.
          </p>

          <h2>Para qué los usamos</h2>
          <ul>
            <li>Procesar y entregar tus pedidos.</li>
            <li>Comunicarnos contigo sobre tu compra, su envío, cambios o devoluciones.</li>
            <li>Atender tus solicitudes, quejas y reclamos.</li>
            <li>Cumplir obligaciones legales, contables y tributarias.</li>
          </ul>

          <h2>Con quién los compartimos</h2>
          <p>
            Con la empresa transportadora que lleva tu pedido, con Wompi, que procesa tu pago, y con Marcolini, la
            plataforma que opera esta tienda en nombre de {responsible}. Los datos de tu tarjeta o cuenta bancaria
            los recibe directamente Wompi: esta tienda nunca los ve ni los guarda.
          </p>

          <h2>Tus derechos</h2>
          <p>
            Puedes conocer, actualizar y rectificar tus datos, pedir prueba de tu autorización, saber cómo los
            usamos, revocar la autorización o pedir que los borremos cuando no exista una obligación legal de
            conservarlos, y presentar quejas ante la Superintendencia de Industria y Comercio.
          </p>

          <h2>Cómo ejercerlos</h2>
          <p>
            Escríbenos
            {contactEmail ? (
              <>
                {" "}a <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              </>
            ) : null}
            {brand.phone ? ` o al teléfono ${brand.phone}` : ""}. Respondemos consultas en un máximo de 10 días
            hábiles y reclamos en un máximo de 15 días hábiles, como indica la ley.
          </p>

          <h2>Vigencia</h2>
          <p>
            Conservamos tus datos mientras sean necesarios para las finalidades descritas y para cumplir nuestras
            obligaciones legales.
          </p>
        </div>
      </div>
    </div>
  );
}
