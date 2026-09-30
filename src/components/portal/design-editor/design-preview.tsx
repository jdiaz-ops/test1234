"use client";

import { useEffect, useRef, useState } from "react";

const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 390;

/// Vista previa = la tienda real dentro de un iframe, mostrando el
/// BORRADOR del tema (la vitrina reconoce que la está mirando su dueña
/// desde el editor — ver getStorefrontTheme). Antes era un dibujo
/// genérico armado con los colores del tema, que no mostraba el logo, el
/// banner ni las secciones reales ("la vista previa no está siendo para
/// nada útil"). En "Computadora" la tienda se renderiza a 1280px y se
/// escala para caber en el espacio disponible; en "Celular" va a 390px.
/// `version` sube cada vez que se guarda el borrador y recarga el iframe.
/// Ver conversación del 2026-09-30.
export function DesignPreview({
  storefrontSlug,
  version,
}: {
  storefrontSlug: string | null;
  version: number;
}) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const firstVersion = useRef(version);

  // ResizeObserver avisa una vez apenas se observa el elemento, así que
  // no hace falta medir a mano al montar.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setBox({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [device, storefrontSlug]);

  // Recarga en el lugar (mismo origen) para no parpadear en blanco; si el
  // navegador terminó en otro origen (cross-origin), volver a asignar el
  // src recarga igual.
  useEffect(() => {
    if (version === firstVersion.current) return;
    const frame = frameRef.current;
    if (!frame) return;
    try {
      frame.contentWindow?.location.reload();
    } catch {
      const url = frame.src;
      frame.src = url;
    }
  }, [version]);

  if (!storefrontSlug) {
    return (
      <div className="sticky top-6 rounded-2xl border border-brand-line bg-brand-surface p-4">
        <p className="text-xs font-medium text-brand-ink-soft mb-1">Vista previa</p>
        <p className="text-sm text-brand-ink-soft">
          Configura el link de tu tienda en Configuración para ver acá tu tienda con los cambios.
        </p>
      </div>
    );
  }

  const src = `/t/${storefrontSlug}`;
  const scale = box.width > 0 ? box.width / DESKTOP_WIDTH : 0.5;
  const boxHeight = Math.max(box.height, 520);

  return (
    <div className="sticky top-6">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs font-medium text-brand-ink-soft">
          Vista previa — tu tienda con los cambios sin publicar
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={`text-[11px] rounded-full px-2.5 py-1 border ${device === "mobile" ? "bg-brand-accent text-white border-brand-accent" : "border-brand-line text-brand-ink-soft"}`}
          >
            Celular
          </button>
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`text-[11px] rounded-full px-2.5 py-1 border ${device === "desktop" ? "bg-brand-accent text-white border-brand-accent" : "border-brand-line text-brand-ink-soft"}`}
          >
            Computadora
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        className={`rounded-2xl border border-brand-line overflow-hidden shadow-sm bg-white ${
          device === "mobile" ? "max-w-full mx-auto" : "w-full"
        }`}
        style={{
          width: device === "mobile" ? MOBILE_WIDTH : undefined,
          height: "min(calc(100vh - 190px), 900px)",
          minHeight: 520,
        }}
      >
        {device === "mobile" ? (
          <iframe
            key="mobile"
            ref={frameRef}
            src={src}
            title="Vista previa de tu tienda"
            className="w-full h-full border-0"
          />
        ) : (
          <iframe
            key="desktop"
            ref={frameRef}
            src={src}
            title="Vista previa de tu tienda"
            className="border-0 origin-top-left"
            style={{
              width: DESKTOP_WIDTH,
              height: boxHeight / scale,
              transform: `scale(${scale})`,
            }}
          />
        )}
      </div>
      <p className="text-[11px] text-brand-ink-soft mt-2">
        Se actualiza sola al guardar. Los compradores siguen viendo lo publicado hasta que le des
        &ldquo;Publicar cambios&rdquo;.
      </p>
    </div>
  );
}
