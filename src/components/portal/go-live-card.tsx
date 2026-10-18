"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GoLiveChecklist, GoLiveKey } from "@/server/services/go-live-service";

/// "Lo que falta para vender" en el panel de la marca (ver
/// go-live-service.ts): cada paso con link a donde se resuelve; los que
/// no se pueden saber solos tienen "Marcar como listo".
export function GoLiveCard({ checklist }: { checklist: GoLiveChecklist }) {
  const router = useRouter();
  const [items, setItems] = useState(checklist.items);
  const [busy, setBusy] = useState<GoLiveKey | null>(null);
  const done = items.filter((i) => i.done).length;

  async function toggle(key: GoLiveKey, next: boolean) {
    setBusy(key);
    try {
      const res = await fetch("/api/marca/tienda/salida", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, done: next }),
      });
      if (res.ok) {
        setItems((list) => list.map((i) => (i.key === key ? { ...i, done: next } : i)));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-accent/30 bg-brand-accent-soft/40 p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div>
          <p className="text-sm font-medium text-brand-ink">Lo que falta para vender</p>
          <p className="text-xs text-brand-ink-soft mt-1">
            {done} de {items.length} listos. Cuando estén todos, tu tienda queda lista para recibir pedidos de verdad.
          </p>
        </div>
        {checklist.storeUrl && (
          <a
            href={checklist.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-brand-accent hover:underline"
          >
            Ver mi tienda →
          </a>
        )}
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 text-sm">
            <span
              aria-hidden
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                item.done ? "border-brand-accent bg-brand-accent text-white" : "border-brand-line bg-white text-transparent"
              }`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className={item.done ? "text-brand-ink-soft line-through" : "text-brand-ink"}>
                {item.label}
                {item.optional && !item.done && <span className="text-xs text-brand-ink-soft"> · opcional</span>}
              </p>
              <p className="text-xs text-brand-ink-soft">{item.detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs">
              {!item.done &&
                (item.href.startsWith("http") ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                    Ir
                  </a>
                ) : (
                  <Link href={item.href} className="text-brand-accent hover:underline">
                    Ir
                  </Link>
                ))}
              {item.manual && (
                <button
                  type="button"
                  onClick={() => toggle(item.key, !item.done)}
                  disabled={busy === item.key}
                  className="text-brand-ink-soft hover:underline disabled:opacity-50"
                >
                  {item.done ? "Desmarcar" : "Marcar como listo"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
