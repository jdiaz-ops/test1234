"use client";

import { useEffect, useState } from "react";
import type { ThemeConfig } from "@/lib/brand-theme";

/// Barra fija arriba del encabezado con hasta 4 mensajes — si hay más de
/// uno, se deslizan cada 4s (translateX con transición, no un corte
/// seco). Fondo = colores.secundario (ver el wrapper de variables CSS en
/// el layout). Ver conversación del 2026-09-14 (creada) y 2026-09-15
/// (pedido explícito de que los textos "se deslicen", subido a 4).
export function AnnouncementBar({
  config,
}: {
  config: ThemeConfig["announcementBar"];
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
      className="overflow-hidden text-center text-xs font-medium"
      style={{ background: "var(--brand-secondary)", color: "var(--brand-ink)" }}
    >
      <div
        className="flex transition-transform duration-500 ease-in-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {messages.map((m, i) => (
          <div key={i} className="w-full shrink-0 py-2 px-4">
            {m.link ? <a href={m.link} className="hover:underline">{m.text}</a> : m.text}
          </div>
        ))}
      </div>
    </div>
  );
}
