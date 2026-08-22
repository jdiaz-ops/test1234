"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Creator = {
  id: string;
  displayName: string;
  city: string | null;
  baseCode: string;
  suspended: boolean;
  _count: { enrollments: number };
};

export function AdminCreatorsPanel({ creators }: { creators: Creator[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggleSuspended(creatorId: string, suspended: boolean) {
    setLoadingId(creatorId);
    await fetch("/api/admin/creadores/suspender", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId, suspended }),
    });
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
            <th className="px-5 py-3 font-normal">Creador</th>
            <th className="px-5 py-3 font-normal">Código</th>
            <th className="px-5 py-3 font-normal">Marcas</th>
            <th className="px-5 py-3 font-normal">Estado</th>
            <th className="px-5 py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {creators.map((c) => (
            <tr key={c.id}>
              <td className="px-5 py-3 text-brand-ink">
                {c.displayName}
                {c.city && <span className="text-brand-ink-soft"> · {c.city}</span>}
              </td>
              <td className="px-5 py-3 font-mono text-brand-accent">{c.baseCode}</td>
              <td className="px-5 py-3 font-mono text-brand-ink-soft">{c._count.enrollments}</td>
              <td className="px-5 py-3">
                {c.suspended ? (
                  <span className="text-red-600 font-medium">Suspendido</span>
                ) : (
                  <span className="text-brand-accent font-medium">Activo</span>
                )}
              </td>
              <td className="px-5 py-3">
                <button
                  onClick={() => toggleSuspended(c.id, !c.suspended)}
                  disabled={loadingId === c.id}
                  className="text-xs text-brand-ink-soft hover:text-red-600 hover:underline"
                >
                  {c.suspended ? "Reactivar" : "Suspender"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
