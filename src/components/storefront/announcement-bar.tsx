"use client";

import { useEffect, useState } from "react";
import { resolveColorRef, type ThemeConfig } from "@/lib/brand-theme";

const TEXT_SIZE_CLASS = {
  small: "text-xs py-2",
  medium: "text-sm py-2",
  large: "text-base py-2.5",
};

/// Barra fija arriba del encabezado con hasta 4 mensajes — si hay más de
/// uno, se deslizan cada 4s (translateX con transición, no un corte
/// seco). Colores y tamaño del texto se eligen en Diseño → Barra de
/// anuncio (ver theme.announcementBar). Ver conversación del 2026-09-14
/// (creada), 2026-09-15 (pedido explícito de que los textos "se
/// deslicen", subido a 4) y 2026-09-30 (colores y tamaño configurables).
export function AnnouncementBar({
  config,
  colors,
}: {
  config: ThemeConfig["announcementBar"];
  colors: ThemeConfig["colors"];
}) {
  const messages = config.messages.filter((m) => m.text.trim());
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [messages.length]);

  if (!config.enabled || messages.length === 0) return null;

  return (
    <div
      className="overflow-hidden text-center font-medium"
      style={{
        background: resolveColorRef(colors, config.bgColorRef),
        color: resolveColorRef(colors, config.textColorRef),
      }}
    >
      <div
        className="flex transition-transform duration-500 ease-in-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {messages.map((m, i) => (
          <div key={i} className={`w-full shrink-0 px-4 ${TEXT_SIZE_CLASS[config.textSize]}`}>
            {m.link ? <a href={m.link} className="hover:underline">{m.text}</a> : m.text}
          </div>
        ))}
      </div>
    </div>
  );
}
