import { PoweredByBadge } from "@/components/storefront/powered-by-badge";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { StoreFooter } from "@/components/storefront/store-footer";
import { PromoPopup } from "@/components/storefront/promo-popup";
import { StorefrontThemeProvider } from "@/components/storefront/storefront-theme-context";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { getPublishedTheme } from "@/server/services/brand-theme-service";
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
    return (
      <>
        {children}
        <PoweredByBadge />
      </>
    );
  }

  const [theme, menuItemsRaw, basePath] = await Promise.all([
    getPublishedTheme(brand.id),
    listStorefrontMenuItems(brand.id),
    getStoreBasePath(slug),
  ]);
  const menuItems = menuItemsRaw.map((i) => ({ id: i.id, label: i.label, url: i.url }));

  const cssVars = themeToCssVars(theme);
  const fontsUrl = buildGoogleFontsUrl([theme.typography.headingFont, theme.typography.bodyFont]);
  const customCss = theme.customCss ? sanitizeCustomCss(theme.customCss) : "";

  return (
    <>
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
      <StorefrontThemeProvider theme={theme}>
        <div
          data-storefront-root
          data-rounded={roundedDataAttr(theme)}
          style={cssVars as React.CSSProperties}
        >
          <AnnouncementBar config={theme.announcementBar} />
          {children}
          <StoreFooter
            config={theme.footer}
            colors={theme.colors}
            brandName={brand.companyName}
            phone={brand.phone}
            websiteUrl={brand.websiteUrl}
            instagramHandle={brand.instagramHandle}
            tiktokHandle={brand.tiktokHandle}
            menuItems={menuItems}
            basePath={basePath}
          />
          <PromoPopup config={theme.popup} brandSlug={slug} />
        </div>
      </StorefrontThemeProvider>
      <PoweredByBadge />
    </>
  );
}
