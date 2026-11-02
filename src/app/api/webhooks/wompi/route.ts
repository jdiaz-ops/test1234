import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { referenceOwner } from "@/lib/payment-reference";
import { runLater } from "@/lib/run-later";
import { gatewayForOrder } from "@/server/payments/credentials";
import { sharedWompiEventsSecret, verifyWompiEventChecksum } from "@/server/integrations/wompi-client";
import { relayWompiEvent } from "@/server/integrations/wompi-relay";
import { applyWompiTransactionStatus } from "@/server/services/store-order-service";

/// El reenvío corre después de responder (ver runLater), con sus
/// reintentos: hasta ~30 s.
export const maxDuration = 60;

type WompiEvent = {
  event?: unknown;
  environment?: unknown;
  data?: { transaction?: { id?: unknown; reference?: unknown; status?: unknown } };
  signature?: { checksum?: unknown; properties?: unknown };
  timestamp?: unknown;
};

const ok = () => NextResponse.json({ ok: true });
const log = (message: string) => console.info(`[wompi-webhook] ${message}`);

/// Si el evento viene firmado con ese secreto de eventos. Sin firma
/// completa, no.
function signedWith(body: WompiEvent, secret: string) {
  const { checksum, properties } = body.signature ?? {};
  if (typeof checksum !== "string" || typeof body.timestamp !== "number") return false;
  if (!Array.isArray(properties) || !properties.every((p) => typeof p === "string")) return false;
  return verifyWompiEventChecksum({ data: body.data, properties, timestamp: body.timestamp, checksum, eventsKey: secret });
}

/// Lo que Wompi manda en los headers y la otra app puede necesitar para
/// verificar el evento por su cuenta.
function wompiHeaders(req: Request): Record<string, string> {
  const checksum = req.headers.get("x-event-checksum");
  return checksum ? { "x-event-checksum": checksum } : {};
}

/// Receptor único de eventos de Wompi. Llegan los de la cuenta de cada
/// marca (cada una pone esta URL en su panel de Wompi) y los de la cuenta
/// compartida con Nail Fest: Wompi permite una sola URL de eventos por
/// cuenta. El prefijo de la referencia dice de quién es (ver
/// referenceOwner), y la firma se verifica con el secreto de la cuenta que
/// lo manda — nunca con uno solo para todos, o los pagos de las demás
/// marcas se rechazarían (pedido del 2026-10-29):
/// - mt_: un pedido de la tienda. Firma con la llave de eventos de la
///   marca (la del modo con que se cobró ese pedido) y se procesa;
///   repetido no duplica nada (ver applyPaymentResult).
/// - NF-: de Nail Fest. Firma con WOMPI_EVENTS_SECRET y se reenvía tal cual
///   a NAILFEST_EVENTS_URL con x-relay-secret.
/// - sample_ / prbox_: muestras de $0, nunca se cobran: se ignoran.
/// - Cualquier otra (otras tiendas con referencias al azar): se ignora.
///   La tienda Shopify que usaba la cuenta compartida ya no se usa
///   (2026-11-02): ya no se le reenvía nada.
/// Firma inválida: 401. Todo lo demás responde 200, aunque el reenvío
/// falle (queda en el log). Si falla nuestra base al procesar un mt_, el
/// error hace que Wompi lo reintente.
export async function POST(req: Request) {
  // Crudo: se reenvía con los mismos bytes.
  const rawBody = await req.text();
  let body: WompiEvent | null = null;
  try {
    body = JSON.parse(rawBody) as WompiEvent;
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || body.event !== "transaction.updated") {
    log(`evento ignorado: ${body && typeof body === "object" ? String(body.event) : "no es JSON"}`);
    return ok();
  }

  const transaction = body.data?.transaction;
  const reference = typeof transaction?.reference === "string" ? transaction.reference : "";
  const transactionId = transaction?.id != null ? String(transaction.id) : null;
  const status = typeof transaction?.status === "string" ? transaction.status : null;
  // Para los logs: nunca el payload completo (trae datos del comprador).
  const about = `${reference || "(sin referencia)"} (transacción ${transactionId ?? "?"}, ${status ?? "?"}, ${String(body.environment ?? "?")})`;
  if (!reference) {
    log(`evento sin referencia, ignorado: ${about}`);
    return ok();
  }

  switch (referenceOwner(reference)) {
    case "marcolini": {
      const order = await prisma.storeOrder.findUnique({ where: { reference }, include: { brand: true } });
      if (!order) {
        log(`pedido no encontrado, ignorado: ${about}`);
        return ok();
      }
      // Las llaves con que se cobró ESE pedido: la marca pudo cambiar de
      // pasarela o de modo después.
      const gateway = gatewayForOrder(order.brand, order);
      const eventsKey = gateway?.provider === "WOMPI" ? gateway.values.eventsKey : null;
      if (!eventsKey) {
        log(`la marca no tiene la llave de eventos de Wompi de este pedido, ignorado: ${about}`);
        return ok();
      }
      if (!signedWith(body, eventsKey)) {
        log(`firma inválida: ${about}`);
        return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
      }
      if (!transactionId || !status) {
        log(`evento sin transacción o estado, ignorado: ${about}`);
        return ok();
      }
      await applyWompiTransactionStatus({ reference, wompiTransactionId: transactionId, wompiStatus: status });
      return ok();
    }

    case "nailfest": {
      const secret = sharedWompiEventsSecret(body.environment);
      if (!secret) {
        console.error(`[wompi-webhook] Sin el secreto de eventos de la cuenta compartida (WOMPI_EVENTS_SECRET${body.environment === "test" ? "_TEST" : ""}): no se reenvía a Nail Fest ${about}`);
        return ok();
      }
      if (!signedWith(body, secret)) {
        log(`firma inválida: ${about}`);
        return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
      }
      const url = process.env.NAILFEST_EVENTS_URL?.trim();
      const relaySecret = process.env.RELAY_SHARED_SECRET?.trim();
      if (!url || !relaySecret) {
        console.error(`[wompi-webhook] Falta NAILFEST_EVENTS_URL o RELAY_SHARED_SECRET: no se reenvía a Nail Fest ${about}`);
        return ok();
      }
      await runLater(() =>
        relayWompiEvent(
          { name: "Nail Fest", url, headers: { ...wompiHeaders(req), "x-relay-secret": relaySecret } },
          rawBody,
          { reference, transactionId },
        ),
      );
      return ok();
    }

    case "marcolini-free":
      log(`referencia de una muestra (no se cobra por Wompi), ignorada: ${about}`);
      return ok();

    case "other":
      log(`referencia desconocida, ignorada: ${about}`);
      return ok();
  }
}
