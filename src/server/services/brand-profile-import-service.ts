import { prisma } from "@/lib/prisma";
import { sanitizeProfile, type ExtractedProfile } from "@/lib/legal-extract";
import { publicStoreUrl } from "@/lib/store-url";

/// Guarda en el perfil lo leído de la tienda anterior, solo donde el
/// perfil esté vacío (la marca o el admin pueden haber escrito algo ya).
/// El correo no se guarda: el de la cuenta es el de la dueña. El sitio
/// web queda con el link de la tienda en Marcolini, porque la tienda
/// vieja se va a apagar. Ver conversación del 2026-10-18.
export async function applyExtractedProfile(brandId: string, raw: ExtractedProfile) {
  const fields = sanitizeProfile(raw);
  const brand = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    select: {
      legalName: true,
      taxId: true,
      fiscalAddress: true,
      city: true,
      phone: true,
      description: true,
      websiteUrl: true,
      storefrontSlug: true,
      customDomain: true,
      customDomainVerifiedAt: true,
    },
  });
  const fill: Record<string, string> = {};
  if (!brand.legalName?.trim() && fields.legalName) fill.legalName = fields.legalName;
  if (!brand.taxId?.trim() && fields.taxId) fill.taxId = fields.taxId;
  if (!brand.fiscalAddress?.trim() && fields.fiscalAddress) fill.fiscalAddress = fields.fiscalAddress;
  if (!brand.city?.trim() && fields.city) fill.city = fields.city;
  if (!brand.phone?.trim() && fields.phone) fill.phone = fields.phone;
  if (!brand.description?.trim() && fields.description) fill.description = fields.description;
  const storeUrl = publicStoreUrl(brand);
  if (!brand.websiteUrl?.trim() && storeUrl) fill.websiteUrl = storeUrl;
  if (Object.keys(fill).length > 0) await prisma.brandProfile.update({ where: { id: brandId }, data: fill });
  return { filled: Object.keys(fill) };
}
