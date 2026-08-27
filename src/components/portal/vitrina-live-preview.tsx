import { getPalette, getFont } from "@/lib/creator-storefront-themes";

export type LivePreviewItem = {
  id: string;
  brandName: string;
  logoUrl: string | null;
  visible: boolean;
  discountPercent: number;
  discountCode: string;
};

export type LivePreviewCollection = {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    imageUrl: string | null;
    brandName: string;
  }[];
};

/// Espejo compacto de /c/[slug]/page.tsx — mismo sistema de paleta/fuente,
/// para que lo que el creador ve acá sea exactamente lo que ve su
/// audiencia. Puramente presentacional: recibe el estado EN VIVO del
/// formulario (todavía sin guardar) para que se actualice al toque, sin
/// tener que salir de la página a ver la vitrina real. Envuelto en un
/// marco angosto tipo teléfono — más chico y menos protagonista que un
/// bloque suelto a tamaño completo.
export function VitrinaLivePreview({
  displayName,
  photoUrl,
  palette: paletteKey,
  font: fontKey,
  headline,
  bio,
  items,
  collections = [],
}: {
  displayName: string;
  photoUrl: string | null;
  palette: string;
  font: string;
  headline: string;
  bio: string;
  items: LivePreviewItem[];
  collections?: LivePreviewCollection[];
}) {
  const palette = getPalette(paletteKey);
  const font = getFont(fontKey);
  const visibleItems = items.filter((i) => i.visible);
  const visibleCollections = collections.filter((c) => c.items.length > 0);

  return (
    <div className="lg:sticky lg:top-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-accent" />
        </span>
        <p className="text-sm font-semibold text-brand-ink">
          Vista previa en vivo de tu vitrina
        </p>
      </div>

      {/* Marco tipo teléfono — mismo espíritu que se ve en otras
          plataformas de link-in-bio: chico, angosto, no compite con el
          formulario. */}
      <div
        className="rounded-[26px] p-1.5 bg-brand-ink/85 shadow-md mx-auto"
        style={{ width: 200 }}
      >
        <div
          className="rounded-[20px] overflow-hidden max-h-[420px] overflow-y-auto"
          style={{
            background: palette.bg,
            fontFamily: font.stack,
            color: palette.ink,
          }}
        >
          <div className="px-3 py-5 text-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa, misma foto de la vitrina real
              <img
                src={photoUrl}
                alt=""
                className="w-9 h-9 rounded-full object-cover mx-auto mb-2"
                style={{ border: `2px solid ${palette.surface}` }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center font-semibold text-xs"
                style={{
                  background: palette.accentSoft,
                  color: palette.accent,
                }}
              >
                {displayName[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <p className="text-[10px]" style={{ color: palette.accent }}>
              {displayName}
            </p>
            {headline && (
              <p
                className="text-xs font-semibold mt-1"
                style={{ color: palette.ink }}
              >
                {headline}
              </p>
            )}
            {bio && (
              <p
                className="text-[10px] mt-1"
                style={{ color: palette.inkSoft }}
              >
                {bio}
              </p>
            )}

            {/* Mismo orden que /c/[slug]/page.tsx: marcas/códigos primero,
                colecciones debajo. */}
            <div className="space-y-2 mt-4 text-left">
              {visibleItems.length === 0 ? (
                <p
                  className="text-[10px] text-center"
                  style={{ color: palette.inkSoft }}
                >
                  Próximamente más marcas por aquí.
                </p>
              ) : (
                visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg p-2"
                    style={{
                      background: palette.surface,
                      border: `1px solid ${palette.accentSoft}`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {item.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- vista previa, mismo logo de la vitrina real
                        <img
                          src={item.logoUrl}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[8px] font-semibold"
                          style={{
                            background: palette.accentSoft,
                            color: palette.accent,
                          }}
                        >
                          {item.brandName[0]?.toUpperCase()}
                        </div>
                      )}
                      <p
                        className="text-[10px] font-semibold truncate"
                        style={{ color: palette.ink }}
                      >
                        {item.brandName}
                      </p>
                    </div>
                    <p
                      className="text-[9px]"
                      style={{ color: palette.inkSoft }}
                    >
                      {item.discountPercent}% con{" "}
                      <span
                        className="font-mono font-medium"
                        style={{ color: palette.accent }}
                      >
                        {item.discountCode}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>

            {visibleCollections.length > 0 && (
              <div className="space-y-3 mt-4 text-left">
                {visibleCollections.map((c) => (
                  <div key={c.id}>
                    <p
                      className="text-[10px] font-semibold mb-1"
                      style={{ color: palette.ink }}
                    >
                      {c.name}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {c.items.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md overflow-hidden"
                          style={{
                            background: palette.surface,
                            border: `1px solid ${palette.accentSoft}`,
                          }}
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- vista previa, misma foto del producto real
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-full aspect-square object-cover"
                            />
                          ) : (
                            <div
                              className="w-full aspect-square"
                              style={{ background: palette.accentSoft }}
                            />
                          )}
                          <p
                            className="text-[8px] px-1 pt-0.5 truncate"
                            style={{ color: palette.inkSoft }}
                          >
                            {item.brandName}
                          </p>
                          <p
                            className="text-[9px] px-1 pb-1 font-medium truncate"
                            style={{ color: palette.ink }}
                          >
                            {item.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[8px] mt-4" style={{ color: palette.inkSoft }}>
              Powered by Marcolini
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
