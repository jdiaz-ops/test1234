import ExcelJS from "exceljs";
import type { Prisma, WaitlistKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize-email";
import {
  socialsText,
  type Attribution,
  type BrandWaitlistInput,
  type CreatorWaitlistInput,
} from "@/lib/waitlist";

/// Lista de espera de la página pública (modelo WaitlistEntry). Mientras
/// Marcolini no abre el registro, sirve para medir la demanda que trae la
/// pauta. Ver conversación del 2026-10-01.

/// Inscribe (o actualiza) a alguien. Si el correo ya estaba, se
/// actualizan sus datos pero se conserva el anuncio que lo trajo la
/// primera vez — es el que cuenta para medir la pauta.
async function joinWaitlist(
  kind: WaitlistKind,
  rawEmail: string,
  data: Prisma.WaitlistEntryUpdateInput & { name: string; whatsapp: string },
  attribution: Attribution,
): Promise<{ alreadyJoined: boolean }> {
  const email = normalizeEmail(rawEmail);
  const existing = await prisma.waitlistEntry.findUnique({
    where: { kind_email: { kind, email } },
    select: { id: true },
  });
  if (existing) {
    await prisma.waitlistEntry.update({ where: { id: existing.id }, data });
    return { alreadyJoined: true };
  }

  try {
    await prisma.waitlistEntry.create({
      data: { ...(data as Prisma.WaitlistEntryCreateInput), kind, email, ...attribution },
    });
    return { alreadyJoined: false };
  } catch (err) {
    // Dos envíos simultáneos del mismo correo: el segundo choca con el
    // índice único y simplemente ya quedó inscrito.
    if ((err as { code?: string }).code === "P2002") return { alreadyJoined: true };
    throw err;
  }
}

export function joinCreatorWaitlist(input: CreatorWaitlistInput, attribution: Attribution = {}) {
  return joinWaitlist(
    "CREATOR",
    input.email,
    {
      name: input.name,
      whatsapp: input.whatsapp,
      socials: input.socials,
      audience: input.audience,
      category: input.category,
    },
    attribution,
  );
}

export function joinBrandWaitlist(input: BrandWaitlistInput, attribution: Attribution = {}) {
  return joinWaitlist(
    "BRAND",
    input.email,
    {
      name: input.name,
      company: input.company,
      whatsapp: input.whatsapp,
      handle: input.handle.replace(/^@+/, ""),
      category: input.category,
      salesChannel: input.salesChannel,
    },
    attribution,
  );
}

export function listWaitlist(kind: WaitlistKind) {
  return prisma.waitlistEntry.findMany({ where: { kind }, orderBy: { createdAt: "desc" } });
}

/// "Directo" cuando llegó sin parámetros utm (link compartido, búsqueda…).
export function sourceLabel(entry: { utmSource: string | null; utmCampaign: string | null }) {
  if (!entry.utmSource) return "Directo";
  return entry.utmCampaign ? `${entry.utmSource} · ${entry.utmCampaign}` : entry.utmSource;
}

/// Resumen para Admin: inscritos recientes y cuántos trajo cada anuncio.
export function summarizeWaitlist(entries: { createdAt: Date; utmSource: string | null; utmCampaign: string | null }[]) {
  const now = Date.now();
  const since = (days: number) =>
    entries.filter((e) => now - e.createdAt.getTime() < days * 24 * 60 * 60 * 1000).length;

  const bySource = new Map<string, number>();
  for (const e of entries) {
    const key = sourceLabel(e);
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }
  return {
    lastWeek: since(7),
    lastDay: since(1),
    sources: [...bySource.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export async function buildWaitlistWorkbook(kind: WaitlistKind): Promise<Buffer> {
  const entries = await listWaitlist(kind);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Marcolini";
  const sheet = wb.addWorksheet("Lista de espera");
  const source = [
    { header: "Fuente", key: "utmSource", width: 16 },
    { header: "Medio", key: "utmMedium", width: 14 },
    { header: "Campaña", key: "utmCampaign", width: 24 },
    { header: "Anuncio", key: "utmContent", width: 24 },
    { header: "Llegó desde", key: "referrer", width: 30 },
  ];
  const date = { header: "Fecha", key: "createdAt", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } };
  sheet.columns =
    kind === "BRAND"
      ? [
          date,
          { header: "Marca", key: "company", width: 28 },
          { header: "Nombre", key: "name", width: 28 },
          { header: "Correo", key: "email", width: 32 },
          { header: "WhatsApp", key: "whatsapp", width: 18 },
          { header: "Instagram o web", key: "handle", width: 30 },
          { header: "Categoría", key: "category", width: 20 },
          { header: "Dónde vende", key: "salesChannel", width: 36 },
          ...source,
        ]
      : [
          date,
          { header: "Nombre", key: "name", width: 28 },
          { header: "Correo", key: "email", width: 32 },
          { header: "WhatsApp", key: "whatsapp", width: 18 },
          { header: "Redes", key: "socials", width: 40 },
          { header: "Seguidores", key: "audience", width: 18 },
          { header: "Categoría", key: "category", width: 20 },
          ...source,
        ];
  for (const e of entries) sheet.addRow({ ...e, socials: socialsText(e.socials) });

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
