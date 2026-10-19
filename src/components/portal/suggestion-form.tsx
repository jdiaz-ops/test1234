"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatAudioLength,
  SUGGESTION_KINDS,
  SUGGESTION_MAX_AUDIO_SECONDS,
  SUGGESTION_MAX_CHARS,
  type SuggestionKindId,
} from "@/lib/suggestions";

/// Lo que graba cada navegador: Chrome/Android/Firefox webm u ogg con
/// Opus; Safari mp4.
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" };

type Recording = { blob: Blob; url: string; seconds: number };

/// Grabar una nota de voz en el navegador (MediaRecorder), con tope de
/// SUGGESTION_MAX_AUDIO_SECONDS.
function useVoiceNote() {
  const [state, setState] = useState<"idle" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef<string | null>(null);

  // Al salir de la página: se suelta el micrófono y la grabación.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      rec?.stream.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  async function start() {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no deja grabar audio. Escríbenos el mensaje.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("No pudimos usar el micrófono. Dale permiso en tu navegador y vuelve a intentarlo.");
      return;
    }
    const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setRecording({ blob, url, seconds: Math.min(SUGGESTION_MAX_AUDIO_SECONDS, Math.round((Date.now() - startedAt) / 1000)) });
      setState("recorded");
    };
    recorderRef.current = rec;
    rec.start();
    setSeconds(0);
    setState("recording");
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= SUGGESTION_MAX_AUDIO_SECONDS && rec.state === "recording") rec.stop();
    }, 250);
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function discard() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setRecording(null);
    setSeconds(0);
    setState("idle");
  }

  return { state, seconds, recording, error, start, stop, discard };
}

function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/// El formulario del buzón de sugerencias: qué es (opcional), el mensaje
/// y/o una nota de voz. Lo usan la página "Buzón de sugerencias" y la
/// burbuja de la esquina (`compact`). Ver suggestion-service.ts.
export function SuggestionForm({ compact = false, onSent }: { compact?: boolean; onSent?: () => void }) {
  const router = useRouter();
  const voice = useVoiceNote();
  const [kind, setKind] = useState<SuggestionKindId | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !sending && voice.state !== "recording" && (message.trim().length > 0 || voice.recording !== null);

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    const form = new FormData();
    if (kind) form.set("kind", kind);
    if (message.trim()) form.set("message", message.trim());
    form.set("pagePath", window.location.pathname);
    if (voice.recording) {
      const type = voice.recording.blob.type.split(";")[0];
      form.set("audio", new File([voice.recording.blob], `nota-de-voz.${EXT[type] ?? "webm"}`, { type: voice.recording.blob.type }));
      form.set("audioSeconds", String(voice.recording.seconds));
    }
    try {
      const res = await fetch("/api/sugerencias", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo enviar — intenta de nuevo.");
        return;
      }
      setMessage("");
      setKind(null);
      voice.discard();
      setSent(true);
      router.refresh();
      onSent?.();
    } catch {
      setError("No se pudo enviar — revisa tu conexión e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-brand-ink">
          <span className="font-medium">¡Gracias! Ya nos llegó.</span> Lo leemos todo, y nos ayuda a mejorar Marcolini.
        </p>
        <button type="button" onClick={() => setSent(false)} className="text-xs text-brand-accent hover:underline">
          Enviar otra
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <p className="mb-2 text-xs text-brand-ink">¿Qué nos quieres contar? <span className="text-brand-ink-soft">(opcional)</span></p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTION_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind((v) => (v === k.value ? null : k.value))}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                kind === k.value ? "border-brand-ink bg-brand-ink text-brand-surface" : "border-brand-line text-brand-ink-soft hover:text-brand-ink"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={SUGGESTION_MAX_CHARS}
        rows={compact ? 3 : 5}
        placeholder="Algo que quisieras ver o dejar de ver, una mejora, una queja o algo que se te está haciendo difícil."
        aria-label="Tu mensaje"
        className="w-full rounded-xl border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
      />

      <div className="flex flex-wrap items-center gap-3">
        {voice.state === "idle" && (
          <button
            type="button"
            onClick={voice.start}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-xs text-brand-ink hover:border-brand-ink"
          >
            <MicIcon />
            Grabar nota de voz
          </button>
        )}
        {voice.state === "recording" && (
          <>
            <span className="inline-flex items-center gap-2 text-xs text-brand-ink" aria-live="polite">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" aria-hidden />
              Grabando {formatAudioLength(voice.seconds)} / {formatAudioLength(SUGGESTION_MAX_AUDIO_SECONDS)}
            </span>
            <button
              type="button"
              onClick={voice.stop}
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Detener
            </button>
          </>
        )}
        {voice.state === "recorded" && voice.recording && (
          <div className="flex w-full flex-wrap items-center gap-2">
            <audio controls src={voice.recording.url} className="h-9 max-w-full flex-1" />
            <button type="button" onClick={voice.discard} className="text-xs text-brand-ink-soft hover:text-red-600">
              Borrar
            </button>
          </div>
        )}
      </div>
      {voice.error && <p className="text-xs text-red-600">{voice.error}</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={send}
        disabled={!canSend}
        className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        {sending ? "Enviando…" : "Enviar"}
      </button>
    </div>
  );
}
