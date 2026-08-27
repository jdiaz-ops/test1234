"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Broadcast = {
  id: string;
  audience: "BRANDS" | "CREATORS";
  channel: "EMAIL" | "NOTIFICATION";
  subject: string;
  body: string;
  recipientCount: number;
  createdAt: string;
};

const audienceLabel: Record<string, string> = {
  BRANDS: "Marcas",
  CREATORS: "Creadores",
};
const channelLabel: Record<string, string> = {
  EMAIL: "Correo",
  NOTIFICATION: "Notificación",
};

export function AdminBroadcastPanel({
  broadcasts,
}: {
  broadcasts: Broadcast[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    audience: "CREATORS" as "BRANDS" | "CREATORS",
    channels: { EMAIL: true, NOTIFICATION: false },
    subject: "",
    body: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function toggleChannel(channel: "EMAIL" | "NOTIFICATION") {
    setForm({
      ...form,
      channels: { ...form.channels, [channel]: !form.channels[channel] },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setOk(null);

    const channels = (
      Object.keys(form.channels) as ("EMAIL" | "NOTIFICATION")[]
    ).filter((c) => form.channels[c]);

    const res = await fetch("/api/admin/comunicados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: form.audience,
        channels,
        subject: form.subject,
        body: form.body,
      }),
    });

    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo enviar el comunicado.");
      return;
    }

    setOk(
      `Enviado a ${data.recipientCount} ${form.audience === "BRANDS" ? "marca(s)" : "creador(es)"}.`,
    );
    setForm({
      audience: form.audience,
      channels: form.channels,
      subject: "",
      body: "",
    });
    router.refresh();
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-brand-line bg-brand-surface p-6 space-y-4 max-w-xl mb-10"
      >
        <div>
          <label className="text-xs text-brand-ink-soft block mb-2">
            Enviar a
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-brand-ink">
              <input
                type="radio"
                checked={form.audience === "CREATORS"}
                onChange={() => setForm({ ...form, audience: "CREATORS" })}
              />
              Creadores
            </label>
            <label className="flex items-center gap-2 text-sm text-brand-ink">
              <input
                type="radio"
                checked={form.audience === "BRANDS"}
                onChange={() => setForm({ ...form, audience: "BRANDS" })}
              />
              Marcas
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs text-brand-ink-soft block mb-2">
            Canal
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-brand-ink">
              <input
                type="checkbox"
                checked={form.channels.EMAIL}
                onChange={() => toggleChannel("EMAIL")}
              />
              Correo
            </label>
            <label className="flex items-center gap-2 text-sm text-brand-ink">
              <input
                type="checkbox"
                checked={form.channels.NOTIFICATION}
                onChange={() => toggleChannel("NOTIFICATION")}
              />
              Notificación en la plataforma (será push cuando exista la app)
            </label>
          </div>
        </div>

        <input
          type="text"
          required
          placeholder="Asunto"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="input"
        />
        <textarea
          required
          rows={5}
          placeholder="Mensaje"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          className="input"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-brand-accent">{ok}</p>}

        <button
          type="submit"
          disabled={sending}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Enviar comunicado"}
        </button>
      </form>

      <h2 className="font-display font-semibold text-brand-ink mb-4">
        Historial
      </h2>
      <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Fecha</th>
                <th className="px-5 py-3 font-normal">Para</th>
                <th className="px-5 py-3 font-normal">Canal</th>
                <th className="px-5 py-3 font-normal">Asunto</th>
                <th className="px-5 py-3 font-normal">Destinatarios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {broadcasts.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-6 text-center text-brand-ink-soft"
                  >
                    Todavía no se ha enviado ningún comunicado.
                  </td>
                </tr>
              )}
              {broadcasts.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-3 text-brand-ink-soft">
                    {new Date(b.createdAt).toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-5 py-3 text-brand-ink">
                    {audienceLabel[b.audience]}
                  </td>
                  <td className="px-5 py-3 text-brand-ink-soft">
                    {channelLabel[b.channel]}
                  </td>
                  <td className="px-5 py-3 text-brand-ink">{b.subject}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink-soft">
                    {b.recipientCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
