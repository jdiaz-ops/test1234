import Link from "next/link";
import { TrackInitiateCheckout } from "@/components/storefront/pixel-events";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { prisma } from "@/lib/prisma";
import { getActiveWompiKeys } from "@/server/integrations/wompi-client";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { CartIcon } from "@/components/storefront/mobile-nav-icons";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getStorefrontTheme } from "@/server/services/brand-theme-service";
import { checkoutHeaderColor, contrastTextFor } from "@/lib/brand-theme";

export default async function StorefrontCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const paymentsReady = getActiveWompiKeys(brand) !== null;
  // Con la facturación de Dataico activa, la cédula o NIT es obligatoria
  // en el checkout (si no, opcional). Ver dataico-service.ts.
  const askBilling = Boolean(
    (await prisma.dataicoConnection.findUnique({ where: { brandId: brand.id }, select: { enabled: true } }))?.enabled,
  );
  const basePath = await getStoreBasePath(slug);
  const theme = await getStorefrontTheme(brand.id);
  const headerBg = checkoutHeaderColor(theme);
  const headerInk = contrastTextFor(headerBg);

  // Atribución por cookie de primera parte (ver src/proxy.ts) — si el
  // comprador llegó por el link de un creador y no escribe el código a
  // mano, se lo aplicamos solos.
  const cookieStore = await cookies();
  const referredCode = cookieStore.get("mkl_ref")?.value ?? null;

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Encabezado de checkout como el de Shopify: solo el logo de la
          marca, centrado, sobre una franja de color, y el carrito a la
          derecha para volver — sin menú ni buscador, que acá distraen de
          terminar la compra. Ver conversación del 2026-09-30. */}
      {/* Color de la franja: Diseño → Encabezado (ver checkoutHeaderColor).
          Antes era un gris fijo. */}
      <header className="border-b border-brand-line" style={{ background: headerBg, color: headerInk }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-20 grid grid-cols-[1fr_auto_1fr] items-center">
          <div />
          <Link href={basePath || "/"} className="flex items-center justify-center">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo subido por la marca
              <img
                src={brand.logoUrl}
                alt={brand.companyName}
                className="h-14 w-auto max-w-[220px] object-contain"
              />
            ) : (
              <span className="font-display text-lg font-semibold">
                {brand.companyName}
              </span>
            )}
          </Link>
          <Link
            href={`${basePath}/carrito`}
            aria-label="Volver al carrito"
            className="justify-self-end w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10"
          >
            <CartIcon className="w-6 h-6" />
          </Link>
        </div>
      </header>
      <TrackInitiateCheckout />
      <CheckoutForm
        requireBillingId={askBilling}
        brandSlug={slug}
        basePath={basePath}
        taxRatePercent={Number(brand.taxRatePercent)}
        paymentsReady={paymentsReady}
        referredCode={referredCode}
      />
    </div>
  );
}
