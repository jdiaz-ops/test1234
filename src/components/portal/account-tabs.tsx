"use client";

import { useState, type ReactNode } from "react";

export function AccountTabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div>
      <div className="flex gap-1 border-b border-brand-line mb-8">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2.5 text-sm -mb-px border-b-2 ${
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
