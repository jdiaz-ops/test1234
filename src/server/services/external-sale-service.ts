import { Prisma, type ExternalSale } from "@prisma/client";
import { z } from "zod";
import { dataicoAllowed } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { BILLING_ID_TYPES, getDataicoConnection, issueExternalSaleInvoiceAfter } from "@/server/services/dataico-service";

/// Ventas de otras plataformas de la misma empresa que la marca factura con
/// su conexión de Dataico (ver ExternalSale). Hoy: las boletas de Nail Fest,
/// que es de Audaz Lab S.A.S. como H la Cosedora — así las facturas de las
/// dos salen de una sola numeración de la DIAN, sin que dos sistemas se
/// pisen los números (pedido del 2026-10-26). La otra plataforma cobra por
/// su cuenta y, con el pago aprobado, manda la venta por la API
/// (api/v1/facturas, ver docs/api-facturas.md).

const VALID_IVA_RATES = [0, 5, 16, 19];

export const externalSaleSchema = z
  .object({
    source: z.string().trim().min(1).max(60),
    externalId: z.string().trim().min(1).max(120),
    paidAt: z.coerce.date(),
    paymentMode: z.enum(["TEST", "PRODUCTION"]).default("PRODUCTION"),
    wompiTransactionId: z.string().trim().max(120).nullish(),
    buyer: z.object({
      name: z.string().trim().min(1).max(200),
      firstName: z.string().trim().max(120).nullish(),
      lastName: z.string().trim().max(120).nullish(),
      email: z.string().trim().email().max(200),
      phone: z.string().trim().max(40).nullish(),
      idType: z.enum(BILLING_ID_TYPES.map((t) => t.value) as [string, ...string[]]).nullish(),
      idNumber: z.string().trim().max(40).nullish(),
      companyName: z.string().trim().max(200).nullish(),
    }),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(300),
          quantity: z.number().int().min(1).max(1000),
          unitPriceCents: z.number().int().min(0),
          taxRate: z.number().refine((rate) => VALID_IVA_RATES.includes(rate), "La DIAN solo acepta IVA de 0, 5, 16 o 19 %."),
        }),
      )
      .min(1)
      .max(50),
    totalCents: z.number().int().min(0),
  })
  .refine((sale) => sale.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0) === sale.totalCents, {
    message: "El total no coincide con la suma de lo vendido.",
    path: ["totalCents"],
  });

export type ExternalSaleInput = z.infer<typeof externalSaleSchema>;

/// Lo que se le contesta a la otra plataforma sobre la factura de su venta.
export function externalInvoiceView(sale: Pick<ExternalSale, "einvoiceStatus" | "einvoiceNumber" | "einvoicePdfUrl" | "einvoiceCufe" | "einvoiceError">) {
  return {
    status: sale.einvoiceStatus ?? null,
    number: sale.einvoiceStatus === "ISSUED" ? sale.einvoiceNumber : null,
    pdfUrl: sale.einvoicePdfUrl,
    cufe: sale.einvoiceCufe,
    error: sale.einvoiceError,
  };
}

function saleData(input: ExternalSaleInput) {
  const { buyer } = input;
  const hasId = Boolean(buyer.idType && buyer.idNumber);
  return {
    buyerName: buyer.name,
    buyerFirstName: buyer.firstName || null,
    buyerLastName: buyer.lastName || null,
    buyerEmail: buyer.email.toLowerCase(),
    buyerPhone: buyer.phone || null,
    billingIdType: hasId ? buyer.idType! : null,
    billingIdNumber: hasId ? buyer.idNumber! : null,
    billingName: hasId && buyer.idType === "NIT" ? buyer.companyName || null : null,
    items: input.items as unknown as Prisma.InputJsonValue,
    totalCents: input.totalCents,
    paidAt: input.paidAt,
    paymentMode: input.paymentMode,
    wompiTransactionId: input.wompiTransactionId || null,
  };
}

/// Guarda la venta (una sola vez por plataforma e id: mandarla otra vez no
/// crea otra) y, si todavía no tiene factura, la manda a facturar después
/// de responder. Mientras la factura no ha salido, una venta que llega otra
/// vez actualiza sus datos (ej. la plataforma corrigió el documento); ya
/// emitida, no se toca.
export async function recordExternalSale(brand: { id: string; storefrontSlug: string | null }, input: ExternalSaleInput) {
  const key = { brandId: brand.id, source: input.source, externalId: input.externalId };
  const data = saleData(input);
  let sale = await prisma.externalSale.findUnique({ where: { brandId_source_externalId: key } });
  if (!sale) {
    try {
      sale = await prisma.externalSale.create({ data: { ...key, ...data } });
    } catch (err) {
      // Llegó dos veces al mismo tiempo: la otra ya la creó.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      sale = await prisma.externalSale.findUniqueOrThrow({ where: { brandId_source_externalId: key } });
    }
  } else if (sale.einvoiceStatus === null || sale.einvoiceStatus === "FAILED") {
    sale = await prisma.externalSale.update({ where: { id: sale.id }, data });
  }

  const connection = dataicoAllowed(brand) ? await getDataicoConnection(brand.id) : null;
  if (!connection?.enabled || !connection.prefix) {
    return { sale, invoice: { ...externalInvoiceView(sale), status: "SKIPPED" as const, error: "La facturación con Dataico no está activa en Marcolini." } };
  }
  if (sale.einvoiceStatus !== "ISSUED") {
    issueExternalSaleInvoiceAfter(sale.id);
    return { sale, invoice: { ...externalInvoiceView(sale), status: sale.einvoiceStatus === "FAILED" ? ("FAILED" as const) : ("PENDING" as const) } };
  }
  return { sale, invoice: externalInvoiceView(sale) };
}

export async function findExternalSale(brandId: string, source: string, externalId: string) {
  return prisma.externalSale.findUnique({ where: { brandId_source_externalId: { brandId, source, externalId } } });
}

/// Las de la marca, las más nuevas primero (Pedidos → Facturas de otras plataformas).
export async function listExternalSales(brandId: string, limit = 100) {
  return prisma.externalSale.findMany({ where: { brandId }, orderBy: { createdAt: "desc" }, take: limit });
}
