import { SuggestionForm } from "@/components/portal/suggestion-form";
import { formatShortDateTimeCo } from "@/lib/date-time-co";
import { formatAudioLength, SUGGESTION_KINDS, SUGGESTION_STATUS, type SuggestionStatusId } from "@/lib/suggestions";

type Mine = {
  id: string;
  kind: string | null;
  message: string | null;
  audioUrl: string | null;
  audioSeconds: number | null;
  status: SuggestionStatusId;
  createdAt: Date;
};

/// "Buzón de sugerencias" del portal de marcas y del de creadoras: el
/// formulario y lo que ya mandaron, con su estado (enviada, leída,
/// resuelta) para que vean que sí lo leemos. Pedido del 2026-10-19.
export function SuggestionsPage({ mine }: { mine: Mine[] }) {
  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <p className="mb-2 font-mono text-xs tracking-widest text-brand-accent">BUZÓN DE SUGERENCIAS</p>
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Cuéntanos qué mejorar</h1>
        <p className="mt-2 text-sm text-brand-ink-soft">
          Funciones que quisieras ver o dejar de ver, mejoras, quejas o algo que se te está haciendo difícil. Escríbelo o
          mándanos una nota de voz: lo leemos todo.
        </p>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
        <SuggestionForm />
      </div>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">Lo que nos has enviado</h2>
          <ul className="space-y-2">
            {mine.map((s) => {
              const status = SUGGESTION_STATUS[s.status];
              const kind = SUGGESTION_KINDS.find((k) => k.value === s.kind);
              return (
                <li key={s.id} className="rounded-xl border border-brand-line bg-brand-surface p-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${status.chip}`}>{status.label}</span>
                    {kind && <span className="text-brand-ink">{kind.admin}</span>}
                    <span className="text-brand-ink-soft">{formatShortDateTimeCo(s.createdAt, { year: true })}</span>
                  </div>
                  {s.message && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-brand-ink">{s.message}</p>}
                  {s.audioUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <audio controls preload="none" src={s.audioUrl} className="h-9 w-full max-w-sm" />
                      {s.audioSeconds != null && <span className="text-xs text-brand-ink-soft">{formatAudioLength(s.audioSeconds)}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
