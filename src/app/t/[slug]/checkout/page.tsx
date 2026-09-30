import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { getActiveWompiKeys } from "@/server/integrations/wompi-client";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { CartIcon } from "@/components/storefront/mobile-nav-icons";
import { getStoreBasePath } from "@/lib/store-base-path";

export default async function StorefrontCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const paymentsReady = getActiveWompiKeys(brand) !== null;
  const basePath = await getStoreBasePath(slug);

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
      <header className="bg-brand-accent-soft border-b border-brand-line">
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
              <span className="font-display text-lg font-semibold text-brand-ink">
                {brand.companyName}
              </span>
            )}
          </Link>
          <Link
            href={`${basePath}/carrito`}
            aria-label="Volver al carrito"
            className="justify-self-end w-10 h-10 flex items-center justify-center rounded-full text-brand-ink hover:bg-brand-surface"
          >
            <CartIcon className="w-6 h-6" />
          </Link>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
        <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
          CHECKOUT
        </p>
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
          Termina tu compra
        </h1>
        <CheckoutForm
          brandSlug={slug}
          taxRatePercent={Number(brand.taxRatePercent)}
          paymentsReady={paymentsReady}
          referredCode={referredCode}
        />
      </div>
    </div>
  );
}
