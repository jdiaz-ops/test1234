import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/// Borrar una marca desde Admin → Marcas (solo el Propietario). Pedido el
/// 2026-10-19: "necesito poder borrar un perfil de marca" — por ejemplo
/// una tienda duplicada de prueba o importada dos veces.
///
/// Solo se borra una marca SIN historial de plata: pedidos pagados o
/// devueltos, ventas con creadora, cobros, facturas, tarifas, licencias,
/// encargos de contenido o premios de retos. Esos registros se guardan
/// por ley (ver la política de datos, "conservamos los datos de tus
/// transacciones el tiempo que exija la ley"); a una marca así se la
/// pausa. Lo demás — productos, colecciones, tienda, diseño, páginas,
/// clientes importados, pedidos sin pagar o de prueba, ofertas y los
/// vínculos con creadoras — se borra todo, con la cuenta de la marca. No
/// se puede deshacer.

export class BrandDeleteError extends Error {}

type Db = Prisma.TransactionClient | typeof prisma;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/// Lo que impide borrar la marca, en palabras ("3 pedidos pagados").
async function findBlockers(db: Db, brandId: string): Promise<string[]> {
  const [paidOrders, transactions, charges, invoices, saleFees, licenses, paidContent, rewards] = await Promise.all([
    db.storeOrder.count({ where: { brandId, kind: "PURCHASE", status: { in: ["PAID", "REFUNDED"] }, paymentMode: { not: "TEST" } } }),
    db.transaction.count({ where: { brandId } }),
    db.brandCharge.count({ where: { brandId } }),
    db.brandInvoice.count({ where: { brandId } }),
    db.storeSaleFee.count({ where: { brandId } }),
    db.contentLicense.count({ where: { brandId } }),
    db.paidContentRequest.count({ where: { brandId } }),
    db.challengeReward.count({ where: { challenge: { offer: { brandId } } } }),
  ]);
  const out: string[] = [];
  if (paidOrders) out.push(plural(paidOrders, "pedido pagado", "pedidos pagados"));
  if (transactions) out.push(plural(transactions, "venta con creadora", "ventas con creadora"));
  if (charges) out.push(plural(charges, "cobro a la marca", "cobros a la marca"));
  if (invoices) out.push(plural(invoices, "factura", "facturas"));
  if (saleFees && !paidOrders) out.push(plural(saleFees, "tarifa sobre ventas", "tarifas sobre ventas"));
  if (licenses) out.push(plural(licenses, "licencia de contenido", "licencias de contenido"));
  if (paidContent) out.push(plural(paidContent, "encargo de contenido", "encargos de contenido"));
  if (rewards) out.push(plural(rewards, "premio de reto", "premios de retos"));
  return out;
}

export type BrandDeletionPreview = {
  brand: { id: string; name: string; slug: string | null };
  /// Si no está vacío, la marca no se puede borrar.
  blockers: string[];
  /// Lo que se va a borrar, en palabras ("12 productos").
  willDelete: string[];
};

export async function brandDeletionPreview(brandId: string): Promise<BrandDeletionPreview> {
  const brand = await prisma.brandProfile.findUnique({ where: { id: brandId }, select: { id: true, companyName: true, storefrontSlug: true } });
  if (!brand) throw new BrandDeleteError("La marca ya no existe.");
  const [blockers, products, collections, pages, orders, customers, enrollments, offers] = await Promise.all([
    findBlockers(prisma, brandId),
    prisma.product.count({ where: { brandId } }),
    prisma.brandCollection.count({ where: { brandId } }),
    prisma.storePage.count({ where: { brandId } }),
    prisma.storeOrder.count({ where: { brandId } }),
    prisma.storeCustomer.count({ where: { brandId } }),
    prisma.creatorOfferEnrollment.count({ where: { offer: { brandId } } }),
    prisma.offer.count({ where: { brandId } }),
  ]);
  const willDelete = [
    products ? plural(products, "producto", "productos") : "",
    collections ? plural(collections, "colección", "colecciones") : "",
    pages ? plural(pages, "página", "páginas") : "",
    orders ? plural(orders, "pedido sin pagar o de prueba", "pedidos sin pagar o de prueba") : "",
    customers ? plural(customers, "cliente importado", "clientes importados") : "",
    offers ? plural(offers, "oferta", "ofertas") : "",
    enrollments ? plural(enrollments, "creadora vinculada pierde el vínculo", "creadoras vinculadas pierden el vínculo") : "",
    "la tienda, su diseño, el menú y la cuenta de la marca",
  ].filter(Boolean);
  return { brand: { id: brand.id, name: brand.companyName, slug: brand.storefrontSlug }, blockers, willDelete };
}

function sameName(a: string, b: string) {
  const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  return norm(a) === norm(b);
}

/// Borra la marca y todo lo suyo. `confirmName` tiene que ser el nombre de
/// la marca (como se escribe en la lista), para que no se borre otra por
/// un clic equivocado.
export async function deleteBrandProfile(brandId: string, confirmName: string): Promise<{ deleted: string }> {
  const brand = await prisma.brandProfile.findUnique({
    where: { id: brandId },
    select: { id: true, companyName: true, userId: true, user: { select: { role: true } } },
  });
  if (!brand) throw new BrandDeleteError("La marca ya no existe.");
  if (!sameName(confirmName, brand.companyName)) throw new BrandDeleteError("El nombre no coincide. Escríbelo tal cual aparece en la lista.");

  await prisma.$transaction(
    async (tx) => {
      // Se revisa otra vez adentro: si entró un pago entre la vista previa
      // y el clic, no se borra nada.
      const blockers = await findBlockers(tx, brandId);
      if (blockers.length > 0) throw new BrandDeleteError(`No se puede borrar: tiene ${blockers.join(", ")}.`);

      // Lo que no se va solo con la marca (relaciones sin borrado en
      // cascada), de adentro hacia afuera — igual que en
      // admin-cleanup-service.ts.
      const orders = (await tx.storeOrder.findMany({ where: { brandId }, select: { id: true } })).map((o) => o.id);
      if (orders.length > 0) {
        await tx.sampleRequest.updateMany({ where: { orderId: { in: orders } }, data: { orderId: null } });
        await tx.storeOrder.deleteMany({ where: { id: { in: orders } } });
      }
      await tx.enrollmentInvitation.deleteMany({ where: { OR: [{ offer: { brandId } }, { enrollment: { offer: { brandId } } }] } });

      // El resto (perfil, ofertas y sus vínculos, productos, colecciones,
      // tienda, diseño, páginas, menú, clientes…) se borra en cascada. La
      // cuenta solo se borra si es de marca: nunca la de un admin.
      if (brand.user.role === "BRAND") await tx.user.delete({ where: { id: brand.userId } });
      else await tx.brandProfile.delete({ where: { id: brandId } });
    },
    { timeout: 60_000 },
  );
  return { deleted: brand.companyName };
}
