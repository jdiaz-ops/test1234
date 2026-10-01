"use client";

import { EXTRA_SOCIAL_PLATFORMS, type SocialProfile } from "@/lib/waitlist";

/// Redes en el formulario de lista de espera: una línea fija por cada red
/// de `fixed` (ej. Instagram, TikTok) y un botón para agregar otras — el
/// fuerte de alguien puede estar en otra plataforma. `value` trae primero
/// las fijas, en el mismo orden, y después las agregadas.
export function SocialProfilesField({
  fixed,
  value,
  onChange,
}: {
  fixed: { platform: string; placeholder: string }[];
  value: SocialProfile[];
  onChange: (value: SocialProfile[]) => void;
}) {
  const others = value.slice(fixed.length);
  const update = (i: number, patch: Partial<SocialProfile>) =>
    onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-brand-ink mb-1">
        Tus redes <span className="text-brand-ink-soft">(llena al menos una)</span>
      </legend>
      {fixed.map((f, i) => (
        <div key={f.platform} className="flex items-center gap-2">
          <span className="w-[6.5rem] shrink-0 text-sm text-brand-ink-soft">{f.platform}</span>
          <input
            aria-label={f.platform}
            autoCapitalize="none"
            placeholder={f.placeholder}
            value={value[i]?.handle ?? ""}
            onChange={(e) => update(i, { handle: e.target.value })}
            className="input min-w-0 flex-1"
          />
        </div>
      ))}
      {others.map((s, k) => {
        const i = fixed.length + k;
        return (
          <div key={i} className="flex items-center gap-2">
            <select
              aria-label="Red social"
              value={s.platform}
              onChange={(e) => update(i, { platform: e.target.value })}
              className="input w-[6.5rem] shrink-0"
            >
              {EXTRA_SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              aria-label={`Usuario o link de ${s.platform}`}
              autoCapitalize="none"
              placeholder="Usuario o link"
              value={s.handle}
              onChange={(e) => update(i, { handle: e.target.value })}
              className="input min-w-0 flex-1"
            />
            <button
              type="button"
              aria-label={`Quitar ${s.platform}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="shrink-0 w-8 h-8 rounded-full text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
            >
              ×
            </button>
          </div>
        );
      })}
      {others.length < 8 && (
        <button
          type="button"
          onClick={() => onChange([...value, { platform: EXTRA_SOCIAL_PLATFORMS[0], handle: "" }])}
          className="text-sm text-brand-accent font-medium hover:underline"
        >
          + Agregar otra red
        </button>
      )}
    </fieldset>
  );
}
