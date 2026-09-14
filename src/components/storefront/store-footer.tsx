import Link from "next/link";
import type { ThemeConfig } from "@/lib/brand-theme";
import { resolveColorRef } from "@/lib/brand-theme";

type MenuItem = { id: string; label: string; url: string };

/// Pie de página de la vitrina — no existía antes de esta ronda. Colores
/// propios (opcional, referencia a los mismos roles que el resto del
/// tema), menú de navegación reutilizado (el mismo que arma
/// StorefrontMenuPanel en el portal, no uno aparte para el footer),
/// "sobre nosotros", datos de contacto, redes, y sellos de confianza
/// (solo imagen — ver la nota de seguridad en brand-theme.ts). Ver
/// conversación del 2026-09-14, referencia de Tiendanube.
export function StoreFooter({
  config,
  colors,
  brandName,
  phone,
  websiteUrl,
  instagramHandle,
  tiktokHandle,
  menuItems,
  basePath,
}: {
  config: ThemeConfig["footer"];
  colors: ThemeConfig["colors"];
  brandName: string;
  phone: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  menuItems: MenuItem[];
  basePath: string;
}) {
  const bg = config.useCustomColors ? resolveColorRef(colors, config.bgColorRef) : "var(--brand-ink)";
  const text = config.useCustomColors ? resolveColorRef(colors, config.textColorRef) : "var(--brand-bg)";

  const hasSocial = instagramHandle || tiktokHandle;
  const hasContact = config.contact.show && (phone || websiteUrl);
  const hasMenu = config.menuPrimary.show && menuItems.length > 0;
  const hasAnything =
    config.aboutUs.show ||
    hasMenu ||
    (config.menuSecondary.show && menuItems.length > 0) ||
    hasContact ||
    hasSocial ||
    config.seals.length > 0;

  if (!hasAnything) return null;

  return (
    <footer style={{ background: bg, color: text }} className="mt-16">
      <div className="max-w-3xl mx-auto px-6 py-10 grid sm:grid-cols-3 gap-8 text-sm">
        {config.aboutUs.show && (
          <div>
            {config.aboutUs.title && (
              <p className="font-display font-semibold mb-2">{config.aboutUs.title}</p>
            )}
            {config.aboutUs.description && (
              <p className="opacity-80 leading-relaxed">{config.aboutUs.description}</p>
            )}
          </div>
        )}

        {hasMenu && (
          <div>
            <p className="font-display font-semibold mb-2">{config.menuPrimary.title || "Menú"}</p>
            <ul className="space-y-1.5">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.url.startsWith("/") ? `${basePath}${item.url}` : item.url}
                    className="opacity-80 hover:opacity-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {config.menuSecondary.show && menuItems.length > 0 && (
          <div>
            <p className="font-display font-semibold mb-2">{config.menuSecondary.title || "Menú"}</p>
            <ul className="space-y-1.5">
              {menuItems.map((item) => (
                <li key={`secondary-${item.id}`}>
                  <Link
                    href={item.url.startsWith("/") ? `${basePath}${item.url}` : item.url}
                    className="opacity-80 hover:opacity-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(hasContact || hasSocial) && (
          <div className="space-y-4">
            {hasContact && (
              <div>
                <p className="font-display font-semibold mb-2">{config.contact.title || "Contáctanos"}</p>
                <ul className="space-y-1 opacity-80">
                  {phone && <li>{phone}</li>}
                  {websiteUrl && (
                    <li>
                      <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-100">
                        {websiteUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            )}
            {hasSocial && (
              <div>
                <p className="font-display font-semibold mb-2">{config.social.title || "Síguenos"}</p>
                <div className="flex gap-3 opacity-80">
                  {instagramHandle && (
                    <a
                      href={`https://instagram.com/${instagramHandle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-100"
                    >
                      Instagram
                    </a>
                  )}
                  {tiktokHandle && (
                    <a
                      href={`https://tiktok.com/@${tiktokHandle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-100"
                    >
                      TikTok
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {config.seals.length > 0 && (
        <div className="border-t border-white/10 py-4">
          <div className="max-w-3xl mx-auto px-6 flex items-center justify-center gap-3 flex-wrap opacity-90">
            {config.seals.map((seal, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- sello subido por la marca
              <img key={i} src={seal.imageUrl} alt="" className="h-6 w-auto" />
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs opacity-60 pb-6">
        {brandName} · vendido con Marcolini
      </p>
    </footer>
  );
}
