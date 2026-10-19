import { z } from "zod";
import { bogotaDate, bogotaMidnight } from "@/lib/payout-calendar";

/// Muestras, antes "Cajas PR" (ver PrBox en el schema y pr-box-service.ts;
/// desde el 2026-10-19 se llaman muestras: "puede ser caja PR o swag bag,
/// kit de lanzamiento, productos individuales"): lo puro — fechas
/// del brief, en qué va cada creadora y el formulario de la marca — para
/// usarlo igual en el servidor y en las pantallas. Pedido del 2026-10-19:
/// "la marca crea la Caja PR con fotos, qué incluye y unidades… el brief…
/// ellas la piden desde el marketplace y la marca aprueba, o la marca se la
/// propone… al aprobar se descuenta una unidad, la marca ve la dirección y
/// hace el envío". Hasta ahí llega: lo que publiquen no se sigue.

const DAY_MS = 24 * 3600 * 1000;

/// "2026-11-15" (lo que manda un <input type="date">) → las 00:00 de ese día
/// en Colombia. Null si viene vacío o no es una fecha.
export function parseDay(value: string | null | undefined): Date | null {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = bogotaMidnight(year, month - 1, day);
  const back = bogotaDate(date);
  return back.year === year && back.month === month - 1 && back.day === day ? date : null;
}

/// Al revés: la fecha guardada como la pide un <input type="date">.
export function dayInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const { year, month, day } = bogotaDate(new Date(date));
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/// Si ese día (guardado como sus 00:00 en Colombia) ya terminó.
export function dayIsOver(day: Date | string, now = new Date()) {
  return now.getTime() >= new Date(day).getTime() + DAY_MS;
}

/// "15 de noviembre".
export function formatDay(date: Date | string) {
  return new Date(date).toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });
}

/// Si una creadora la puede pedir hoy: abierta, con unidades y sin pasarse
/// la fecha límite para pedir.
export function prBoxAcceptsRequests(box: { status: string; units: number; unitsUsed: number; requestUntil: Date | string | null }, now = new Date()) {
  return box.status === "OPEN" && box.unitsUsed < box.units && !(box.requestUntil && dayIsOver(box.requestUntil, now));
}

/// Lo que trae la caja, una cosa por línea.
export function prBoxContentsList(contents: string) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•·*-]+/, "").trim())
    .filter(Boolean);
}

export type PrBoxStage = "pedida" | "propuesta" | "por-enviar" | "enviada" | "rechazada" | "no-acepto";

/// En qué va una creadora con su caja: pedida o propuesta → por enviar (ya
/// aprobada) → enviada (su pedido salió). Marcolini no hace seguimiento de
/// lo que ella publique después (pedido del 2026-10-19: "nosotros no
/// hacemos seguimiento"; ver PR_BOX_DISCLAIMER).
export function prBoxStage(request: { status: string; shipped: boolean }): PrBoxStage {
  switch (request.status) {
    case "REQUESTED":
      return "pedida";
    case "PROPOSED":
      return "propuesta";
    case "REJECTED":
      return "rechazada";
    case "DECLINED":
      return "no-acepto";
  }
  return request.shipped ? "enviada" : "por-enviar";
}

/// Para la marca (su lista) y para la creadora (sus cajas), con el mismo
/// color por paso.
export const PR_BOX_STAGE: Record<PrBoxStage, { brand: string; creator: string; tone: string }> = {
  pedida: { brand: "Pedida", creator: "Esperando a la marca", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  propuesta: { brand: "Propuesta", creator: "Te la propusieron", tone: "bg-purple-50 text-purple-700 border-purple-200" },
  "por-enviar": { brand: "Por enviar", creator: "Aprobada", tone: "bg-sky-50 text-sky-800 border-sky-200" },
  enviada: { brand: "Enviada", creator: "En camino", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  rechazada: { brand: "Rechazada", creator: "No esta vez", tone: "bg-neutral-100 text-neutral-600 border-neutral-200" },
  "no-acepto": { brand: "No aceptó", creator: "No la aceptaste", tone: "bg-neutral-100 text-neutral-600 border-neutral-200" },
};

/// Lo que Marcolini no hace, para que quede claro antes de enviar (pedido
/// del 2026-10-19: "para que las marcas no vengan a decir envié a tal y no
/// hizo").
export const PR_BOX_DISCLAIMER =
  "Marcolini conecta tu marca con las creadoras: no garantiza historias, reels ni publicaciones, ni responde por lo que ellas publiquen o comenten. Lo que acuerdes con cada una es entre ustedes.";

const optionalDay = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = parseDay(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Revisa las fechas del brief." });
      return z.NEVER;
    }
    return date;
  });

/// Una foto subida con el resto del portal (Blob o, en local, /uploads/).
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\//.test(v) || v.startsWith("/uploads/"), "Sube las fotos desde el botón.");

export const prBoxInputSchema = z
  .object({
    name: z.string().trim().min(2, "Ponle un nombre a la muestra.").max(80, "El nombre puede tener hasta 80 letras."),
    contents: z.string().trim().min(2, "Escribe qué trae la muestra.").max(1500),
    images: z.array(imageUrl).max(6, "Hasta 6 fotos.").default([]),
    units: z.coerce.number().int("Las unidades van en números enteros.").min(1, "Pon cuántas muestras tienes para regalar.").max(10000),
    contentBrief: z.string().trim().min(5, "Cuéntales qué contenido quieres.").max(1500),
    keyMessages: z.string().trim().max(1500).default(""),
    requestUntil: optionalDay,
    shipsOn: optionalDay,
    launchOn: optionalDay,
    status: z.enum(["DRAFT", "OPEN", "CLOSED"]).default("DRAFT"),
    /// Quién la puede pedir (ver PR_BOX_AUDIENCE): las dos en true es "las
    /// dos" (ellas la piden y la marca la propone).
    inMarketplace: z.boolean().default(true),
    allowProposals: z.boolean().default(true),
  })
  .refine((data) => data.inMarketplace || data.allowProposals, { message: "Elige quién la puede pedir.", path: ["inMarketplace"] });

/// "¿Quién la puede pedir?" — pedido del 2026-10-19: "ofrecer un mix,
/// pueden pedirla y puedo ofrecerla".
export const PR_BOX_AUDIENCE = [
  { key: "both", inMarketplace: true, allowProposals: true, label: "Las dos: ellas la piden y tú también se la propones", hint: "Sale en el marketplace y además se la ofreces a las creadoras que quieras." },
  { key: "marketplace", inMarketplace: true, allowProposals: false, label: "Solo la piden desde el marketplace", hint: "Ellas la piden y tú decides a quién se la apruebas." },
  { key: "invited", inMarketplace: false, allowProposals: true, label: "Solo las creadoras a las que se la propongas", hint: "No sale en el marketplace." },
] as const;

export function prBoxAudience(box: { inMarketplace: boolean; allowProposals: boolean }) {
  return PR_BOX_AUDIENCE.find((a) => a.inMarketplace === box.inMarketplace && a.allowProposals === box.allowProposals) ?? PR_BOX_AUDIENCE[0];
}

export type PrBoxInput = z.infer<typeof prBoxInputSchema>;
