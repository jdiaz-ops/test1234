"use client";

import { useEffect, useState } from "react";
import type { ThemeConfig } from "@/lib/brand-theme";

/// Barra fija arriba del encabezado con hasta 3 mensajes — si hay más de
/// uno, rota cada 4s. Fondo = colores.secundario (ver el wrapper de
/// variables CSS en el layout). Ver conversación del 2026-09-14.
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

  const current = messages[index % messages.length];
  const content = current.link ? (
    <a href={current.link} className="hover:underline">
      {current.text}
    </a>
  ) : (
    current.text
  );

  return (
    <div
      className="text-center text-xs font-medium py-2 px-4"
      style={{ background: "var(--brand-secondary)", color: "var(--brand-ink)" }}
    >
      {content}
    </div>
  );
}
