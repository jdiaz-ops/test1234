"use client";

import { useState } from "react";
import type { ThemeConfig } from "@/lib/brand-theme";
import { resolveColorRef, fontStack } from "@/lib/brand-theme";

const LOGO_SIZE_PX: Record<ThemeConfig["header"]["logoSize"], number> = {
  small: 24,
  medium: 32,
  large: 44,
};

/// Preview representativo del look de la tienda — encabezado + un tramo
/// de la home + footer reaccionando en vivo a lo que se toca en el
/// editor. A propósito NO es la vitrina real pixel a pixel (evitaría
/// duplicar toda la lógica de StoreHeader/StoreFooter dentro del panel
/// de edición) — es suficiente para ver de un vistazo si los colores y
/// la tipografía combinan, antes de publicar. Ver conversación del
/// 2026-09-14.
export function DesignPreview({ theme, brandName }: { theme: ThemeConfig; brandName: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const { colors, header, announcementBar, footer } = theme;

  const headerBg =
    header.bgColorRef === "fondo" ? colors.fondo : resolveColorRef(colors, header.bgColorRef);
  const footerBg = footer.useCustomColors ? resolveColorRef(colors, footer.bgColorRef) : colors.texto;
  const footerText = footer.useCustomColors ? resolveColorRef(colors, footer.textColorRef) : colors.fondo;
  const headingFont = fontStack(theme.typography.headingFont);
  const bodyFont = fontStack(theme.typography.bodyFont);
  const radius = theme.designType.roundedBorders ? "14px" : "4px";
  const activeMessage = announcementBar.enabled ? announcementBar.messages[0] : null;

  return (
    <div className="sticky top-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-brand-ink-soft">Vista previa</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`text-[11px] rounded-full px-2.5 py-1 border ${device === "desktop" ? "bg-brand-accent text-white border-brand-accent" : "border-brand-line text-brand-ink-soft"}`}
          >
            Computadora
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={`text-[11px] rounded-full px-2.5 py-1 border ${device === "mobile" ? "bg-brand-accent text-white border-brand-accent" : "border-brand-line text-brand-ink-soft"}`}
          >
            Celular
          </button>
        </div>
      </div>

      <div
        className={`rounded-2xl border border-brand-line overflow-hidden shadow-sm mx-auto transition-all ${
          device === "mobile" ? "max-w-[320px]" : "max-w-full"
        }`}
        style={{ background: colors.fondo, fontFamily: bodyFont }}
      >
        {activeMessage?.text && (
          <div
            className="text-center text-[11px] py-1.5"
            style={{ background: colors.secundario, color: colors.texto }}
          >
            {activeMessage.text}
          </div>
        )}

        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ background: headerBg, borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="rounded-full flex items-center justify-center font-semibold shrink-0"
              style={{
                width: LOGO_SIZE_PX[header.logoSize],
                height: LOGO_SIZE_PX[header.logoSize],
                background: `color-mix(in srgb, ${colors.principal} 16%, white)`,
                color: colors.principal,
                fontFamily: headingFont,
                fontSize: LOGO_SIZE_PX[header.logoSize] * 0.45,
              }}
            >
              {brandName[0]?.toUpperCase() ?? "M"}
            </div>
            {device === "desktop" && (
              <span className="text-sm font-semibold" style={{ fontFamily: headingFont, color: colors.texto }}>
                {brandName}
              </span>
            )}
          </div>
          <div
            className="text-[11px] rounded-full px-3 py-1 border"
            style={{ borderColor: colors.texto, color: colors.texto, opacity: 0.7 }}
          >
            Carrito
          </div>
        </div>

        <div
          className="aspect-[16/9] flex items-center justify-center text-center px-6"
          style={{
            background: `color-mix(in srgb, ${colors.principal} 20%, white)`,
            borderRadius: 0,
          }}
        >
          <div>
            <p
              className="font-semibold"
              style={{ fontFamily: headingFont, fontSize: device === "mobile" ? 18 : 24, color: colors.texto }}
            >
              Tu tienda, tu estilo
            </p>
            <button
              type="button"
              className="mt-3 text-xs font-medium px-4 py-2"
              style={{ background: colors.principal, color: "#fff", borderRadius: radius }}
            >
              Ver productos
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          {[1, 2].map((i) => (
            <div key={i} style={{ borderRadius: radius, overflow: "hidden" }} className="border border-black/5">
              <div className="aspect-square" style={{ background: `color-mix(in srgb, ${colors.principal} 12%, white)` }} />
              <div className="p-2">
                <p className="text-[11px] truncate" style={{ color: colors.texto }}>
                  Producto de ejemplo
                </p>
                <p className="text-[11px] font-mono" style={{ color: colors.principal }}>
                  $45.000
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-4 text-[11px] flex items-center justify-between" style={{ background: footerBg, color: footerText }}>
          <span style={{ fontFamily: headingFont }}>{footer.contact.show ? footer.contact.title : brandName}</span>
          <span className="opacity-60">vendido con Marcolini</span>
        </div>
      </div>
    </div>
  );
}
