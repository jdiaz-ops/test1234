/// Reenvío de eventos de Wompi a otra app. Una misma cuenta de Wompi cobra
/// para Marcolini y Nail Fest, y Wompi permite una sola URL de eventos por
/// cuenta: la de Marcolini (ver src/app/api/webhooks/wompi/route.ts). Lo
/// de Nail Fest se le reenvía con los mismos bytes con que llegó, así
/// puede verificar el checksum de Wompi por su cuenta.

/// Esperas antes de cada reintento: 4 intentos en total.
export const RELAY_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
const ATTEMPT_TIMEOUT_MS = 5_000;

export type RelayTarget = {
  /// Solo para los logs ("Nail Fest"). La URL no se registra: puede
  /// llevar un token.
  name: string;
  url: string;
  headers?: Record<string, string>;
};

/// Un 4xx (salvo 408 y 429) no se arregla reintentando: la otra app
/// rechazó el evento (ej. un x-relay-secret equivocado).
function worthRetrying(status: number) {
  return status >= 500 || status === 408 || status === 429;
}

/// POST del evento con hasta 3 reintentos (1 s, 2 s y 4 s). Nunca lanza:
/// si no se pudo, deja el error en el log con la referencia y la
/// transacción, para reenviarlo a mano. true si la otra app lo recibió.
export async function relayWompiEvent(
  target: RelayTarget,
  rawBody: string,
  about: { reference: string; transactionId: string | null },
): Promise<boolean> {
  let attempts = 0;
  let lastError = "";
  for (;;) {
    attempts += 1;
    try {
      const res = await fetch(target.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...target.headers },
        body: rawBody,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        cache: "no-store",
      });
      await res.body?.cancel().catch(() => {});
      if (res.ok) return true;
      lastError = `respondió ${res.status}`;
      if (!worthRetrying(res.status)) break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    const wait = RELAY_RETRY_DELAYS_MS[attempts - 1];
    if (wait === undefined) break;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  console.error(
    `[wompi-webhook] No se pudo reenviar a ${target.name} el evento de ${about.reference} (transacción ${about.transactionId ?? "?"}) tras ${attempts} ${attempts === 1 ? "intento" : "intentos"}: ${lastError}`,
  );
  return false;
}
