"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
}

export function MessageThread({
  enrollmentId,
  messages,
  viewerUserId,
  sendUrl,
}: {
  enrollmentId: string;
  messages: Message[];
  viewerUserId: string;
  sendUrl: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);

    const res = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId, body }),
    });

    setSending(false);

    if (!res.ok) {
      const resBody = await res.json();
      setError(resBody.error ?? "No se pudo enviar.");
      return;
    }

    setBody("");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-brand-ink-soft text-center mt-10">
            Todavía no hay mensajes — escribe el primero.
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderUserId === viewerUserId;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isMine ? "bg-brand-accent text-white" : "bg-brand-bg text-brand-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? "text-white/70" : "text-brand-ink-soft"}`}>
                    {new Date(m.createdAt).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-brand-line p-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          Enviar
        </button>
      </form>
      {error && <p className="text-xs text-red-600 px-3 pb-2">{error}</p>}
    </div>
  );
}
