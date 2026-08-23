import { getPalette, getFont } from "@/lib/creator-storefront-themes";

export type LivePreviewItem = {
  id: string;
  brandName: string;
  logoUrl: string | null;
  visible: boolean;
  discountPercent: number;
  discountCode: string;
};

/// Espejo compacto de /c/[slug]/page.tsx — mismo sistema de paleta/fuente,
/// para que lo que el creador ve acá sea exactamente lo que ve su
/// audiencia. Puramente presentacional: recibe el estado EN VIVO del
/// formulario (todavía sin guardar) para que se actualice al toque, sin
/// tener que salir de la página a ver la vitrina real.
export function VitrinaLivePreview({
  displayName,
  photoUrl,
  palette: paletteKey,
  font: fontKey,
  headline,
  bio,
  items,
}: {
  displayName: string;
  photoUrl: string | null;
  palette: string;
  font: string;
  headline: string;
  bio: string;
  items: LivePreviewItem[];
}) {
  const palette = getPalette(paletteKey);
  const font = getFont(fontKey);
  const visibleItems = items.filter((i) => i.visible);

  return (
    <div className="lg:sticky lg:top-6">
      <p className="text-xs text-brand-ink-soft mb-2">Vista previa en vivo</p>
      <div
        className="rounded-2xl border border-brand-line overflow-hidden shadow-sm"
        style={{ background: palette.bg, fontFamily: font.stack, color: palette.ink }}
      >
        <div className="px-5 py-8 text-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa, misma foto de la vitrina real
            <img
              src={photoUrl}
              alt=""
              className="w-14 h-14 rounded-full object-cover mx-auto mb-3"
              style={{ border: `2px solid ${palette.surface}` }}
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center font-semibold text-sm"
              style={{ background: palette.accentSoft, color: palette.accent }}
            >
              {displayName[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <p className="text-xs" style={{ color: palette.accent }}>
            {displayName}
          </p>
          {headline && (
            <p className="font-semibold mt-1" style={{ color: palette.ink }}>
              {headline}
            </p>
          )}
          {bio && (
            <p className="text-xs mt-1.5" style={{ color: palette.inkSoft }}>
              {bio}
            </p>
          )}

          <div className="space-y-2.5 mt-5 text-left">
            {visibleItems.length === 0 ? (
              <p className="text-xs text-center" style={{ color: palette.inkSoft }}>
                Próximamente más marcas por aquí.
              </p>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl p-3"
                  style={{ background: palette.surface, border: `1px solid ${palette.accentSoft}` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {item.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- vista previa, mismo logo de la vitrina real
                      <img src={item.logoUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold"
                        style={{ background: palette.accentSoft, color: palette.accent }}
                      >
                        {item.brandName[0]?.toUpperCase()}
                      </div>
                    )}
                    <p className="text-xs font-semibold" style={{ color: palette.ink }}>
                      {item.brandName}
                    </p>
                  </div>
                  <p className="text-[11px]" style={{ color: palette.inkSoft }}>
                    Obtén {item.discountPercent}% con mi código{" "}
                    <span className="font-mono font-medium" style={{ color: palette.accent }}>
                      {item.discountCode}
                    </span>
                  </p>
                </div>
              ))
            )}
          </div>

          <p className="text-[10px] mt-6" style={{ color: palette.inkSoft }}>
            Powered by Marcolini
          </p>
        </div>
      </div>
    </div>
  );
}
