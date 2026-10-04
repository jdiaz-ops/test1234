import { PoweredByBadge } from "@/components/storefront/powered-by-badge";
import { AdPixels } from "@/components/storefront/ad-pixels";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { StoreFooter } from "@/components/storefront/store-footer";
import { HideInCheckout } from "@/components/storefront/hide-in-checkout";
import { PromoPopup } from "@/components/storefront/promo-popup";
import { MobileBottomNav } from "@/components/storefront/mobile-bottom-nav";
import { CartProvider } from "@/components/storefront/cart-context";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { StorefrontThemeProvider } from "@/components/storefront/storefront-theme-context";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { resolveSlugRedirect } from "@/server/services/brand-store-config-service";
import { ROOT_DOMAIN } from "@/lib/subdomain";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { getStorefrontTheme } from "@/server/services/brand-theme-service";
import { getStoreBasePath } from "@/lib/store-base-path";
import {
  themeToCssVars,
  roundedDataAttr,
  buildGoogleFontsUrl,
  sanitizeCustomCss,
} from "@/lib/brand-theme";

/// Envuelve TODA la vitrina pública de una marca — acá se aplica el tema
/// publicado (colores/tipografía vía variables CSS, sin tocar un solo
/// componente de abajo), la barra de anuncio, el footer (nuevo, no
/// existía) y el pop-up promocional. Ver conversación del 2026-09-14,
/// recorrido completo del editor de diseño de Tiendanube — esto es el
/// motor que aplica lo que se configura en /marca/tienda/diseno.
/// La pestaña del navegador muestra el ícono de la marca (o su logo), no
/// el de Marcolini. El favicon.ico de Marcolini vive en public/ (no en
/// app/) justamente para que esto lo pueda reemplazar: el de app/ se pega
/// en todas las páginas sin importar lo que diga acá.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  const icon = brand?.faviconUrl || brand?.logoUrl;
  return icon ? { icons: { icon, apple: icon } } : {};
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);

  // Sin marca (slug inválido) — el page.tsx correspondiente llama
  // notFound(), pero el layout igual se renderiza por encima de ese
  // boundary, así que queda un fallback simple sin tema ni footer.
  if (!brand) {
    // ¿Es un link viejo de una tienda a la que se le cambió el link? Lleva
    // a la misma página en el link nuevo. Ver BrandSlugRedirect.
    const newSlug = await resolveSlugRedirect(slug);
    if (newSlug) {
      const path = (await headers()).get("x-marcolini-path") ?? "/";
      redirect(`https://${newSlug}.${ROOT_DOMAIN}${path.startsWith("/") ? path : "/"}`);
    }
    return (
      <>
        {children}
        <PoweredByBadge />
      </>
    );
  }

  const [theme, menuItemsRaw, basePath] = await Promise.all([
    getStorefrontTheme(brand.id),
    listStorefrontMenuItems(brand.id),
    getStoreBasePath(slug),
  ]);
  const menuItems = menuItemsRaw.map((i) => ({ id: i.id, label: i.label, url: i.url }));

  const cssVars = themeToCssVars(theme);
  const fontsUrl = buildGoogleFontsUrl([
    theme.typography.headingFont,
    theme.typography.bodyFont,
    ...(theme.announcementBar.font ? [theme.announcementBar.font] : []),
  ]);
  const customCss = theme.customCss ? sanitizeCustomCss(theme.customCss) : "";

  return (
    <>
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
      {/* Píxeles de Meta/TikTok de la marca, si los configuró (Configuración
          → Píxeles de anuncios). */}
      <AdPixels metaPixelId={brand.metaPixelId} tiktokPixelId={brand.tiktokPixelId} />
      <StorefrontThemeProvider theme={theme}>
        {/* Un solo CartProvider para toda la vitrina — antes cada página
            armaba el suyo, duplicado; acá arriba lo pueden usar tanto el
            contenido (children) como el navegador móvil y el drawer del
            carrito, que viven al mismo nivel. Ver conversación del
            2026-09-14 (carrito en drawer, no navega a /carrito). */}
        <CartProvider brandSlug={slug}>
          {/* Todo lo de la tienda vive dentro de este contenedor, que es el
              que aplica los colores y letras de la marca (cssVars). Antes el
              panel del carrito y el sello "Creado con Marcolini" quedaban
              afuera: salían con los colores por defecto de Marcolini (rosado)
              y, debajo del contenido, se veía una franja de ese fondo. Ver
              conversación del 2026-10-01. */}
          <div
            data-storefront-root
            data-rounded={roundedDataAttr(theme)}
            style={cssVars as React.CSSProperties}
            className={`min-h-screen bg-brand-bg ${theme.mobileNav.enabled ? "pb-16 sm:pb-0" : ""}`}
          >
            <AnnouncementBar config={theme.announcementBar} colors={theme.colors} />
            {children}
            <HideInCheckout>
              <StoreFooter
                config={theme.footer}
                colors={theme.colors}
                phone={brand.phone}
                websiteUrl={brand.websiteUrl}
                instagramHandle={brand.instagramHandle}
                tiktokHandle={brand.tiktokHandle}
                menuItems={menuItems}
                basePath={basePath}
              />
            </HideInCheckout>
            <PromoPopup config={theme.popup} brandSlug={slug} />
            <MobileBottomNav config={theme.mobileNav} basePath={basePath} />
            <PoweredByBadge />
            <CartDrawer brandSlug={slug} basePath={basePath} />
          </div>
        </CartProvider>
      </StorefrontThemeProvider>
    </>
  );
}
