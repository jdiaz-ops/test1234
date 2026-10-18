import Anthropic from "@anthropic-ai/sdk";

/// Estado de la conexión con la IA (Claude): si la llave está puesta en
/// este despliegue, si es válida y si la cuenta tiene crédito. Lo usa el
/// admin (Configuración → Inteligencia artificial → "Probar conexión")
/// para no adivinar si ANTHROPIC_API_KEY quedó bien en Vercel. La prueba
/// pide una respuesta de una palabra: cuesta una fracción de centavo.
/// Ver conversación del 2026-10-18.

export const AI_MODEL = "claude-opus-5-5";

export type AiStatus = {
  /// Hay ANTHROPIC_API_KEY en este despliegue.
  configured: boolean;
  /// null = no se pudo saber.
  keyValid: boolean | null;
  credit: boolean | null;
  model: string;
  latencyMs: number | null;
  error: string | null;
};

/// Lo que la API contestó, en palabras: la llave está mala, no hay
/// crédito, límite de solicitudes, caída.
export function describeAiError(err: unknown): { keyValid: boolean | null; credit: boolean | null; message: string } {
  const raw = typeof err === "object" && err && "status" in err ? (err as { status?: unknown }).status : undefined;
  const status = typeof raw === "number" ? raw : NaN;
  const message = err instanceof Error ? err.message : String(err);
  if (status === 401) {
    return { keyValid: false, credit: null, message: "La llave no es válida (la API respondió 401). Revisa que en Vercel esté completa, sin espacios, y que el despliegue sea posterior a ponerla." };
  }
  if (status === 403) return { keyValid: true, credit: null, message: "La llave es válida pero no tiene permiso para este modelo (403)." };
  if (status === 400 && /credit|balance|billing/i.test(message)) {
    return { keyValid: true, credit: false, message: "La llave es válida pero la cuenta no tiene crédito: carga saldo en Billing en platform.claude.com." };
  }
  if (status === 429) return { keyValid: true, credit: true, message: "La llave funciona; la API está limitando las solicitudes por ahora (429). Vuelve a probar en un minuto." };
  if (status === 529 || status >= 500) return { keyValid: true, credit: null, message: `La API de Anthropic no respondió bien (${status}). Vuelve a probar en un momento.` };
  return { keyValid: null, credit: null, message: `No se pudo probar: ${message}` };
}

export async function checkAiStatus(): Promise<AiStatus> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { configured: false, keyValid: null, credit: null, model: AI_MODEL, latencyMs: null, error: "ANTHROPIC_API_KEY no está configurada en este despliegue." };
  }
  const client = new Anthropic({ timeout: 25_000, maxRetries: 0 });
  const started = Date.now();
  try {
    // Una respuesta mínima prueba llave, modelo y crédito de una vez.
    await client.messages.create({
      model: AI_MODEL,
      max_tokens: 256,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "Responde solo con la palabra: ok" }],
    });
    return { configured: true, keyValid: true, credit: true, model: AI_MODEL, latencyMs: Date.now() - started, error: null };
  } catch (err) {
    const described = describeAiError(err);
    return { configured: true, keyValid: described.keyValid, credit: described.credit, model: AI_MODEL, latencyMs: Date.now() - started, error: described.message };
  }
}
