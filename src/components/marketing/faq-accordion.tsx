"use client";

import { useState } from "react";
import { IconChevronDown } from "@/components/marketing/icons";

type FaqItem = { pregunta: string; respuesta: string };

/// Acordeón simple: preguntas cerradas por defecto, una sola abierta a la
/// vez (clic en la que está abierta la cierra). Reemplaza la lista
/// estática anterior — con muchas preguntas, tenerlas todas abiertas de
/// entrada hacía la sección más larga de lo necesario para escanear.
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-brand-line">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.pregunta}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 py-6 text-left"
            >
              <span className="font-display font-semibold text-brand-ink">{item.pregunta}</span>
              <IconChevronDown
                className={`w-4 h-4 text-brand-ink-soft shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <p className="text-brand-ink-soft leading-relaxed pb-6 pr-8">{item.respuesta}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
