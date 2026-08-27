"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export function AccountTabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initial = tabs.find((t) => t.key === requestedTab)?.key ?? tabs[0]?.key;
  const [active, setActive] = useState(initial);

  return (
    <div>
      {/* overflow-x-auto + shrink-0/whitespace-nowrap en cada tab: con 8
          pestañas no caben todas en un viewport angosto — antes esto
          desbordaba el contenedor sin ninguna señal de que se podía
          deslizar, rompiendo el layout en vez de dar scroll horizontal
          limpio. El scroll nativo táctil (mobile) ya se siente natural
          sin necesitar una barra de scroll visible. */}
      <div className="flex gap-1 border-b border-brand-line mb-8 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm -mb-px border-b-2 ${
              active === t.key
                ? "border-brand-accent text-brand-accent font-medium"
                : "border-transparent text-brand-ink-soft hover:text-brand-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} className={active === t.key ? "" : "hidden"}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
