import { prisma } from "@/lib/prisma";
import type { BrandProfile } from "@prisma/client";

export type OnboardingStep = {
  key: string;
  label: string;
  description: string;
  done: boolean;
};

/// Lo mínimo que una marca necesita para "salir en vivo": perfil presentable,
/// tienda conectada (para que la atribución funcione), haber entendido cómo
/// funciona el cobro mensual, y al menos una oferta creada. Mientras falte
/// algo, la marca puede seguir navegando el portal libremente, pero no
/// aparece en el marketplace — ver listActiveOffers en
/// marketplace-service.ts, que aplica exactamente estas mismas condiciones
/// (más el bloqueo por falta de pago, que es aparte — ver
/// isBrandPaymentLocked en payment-service.ts).
export async function getBrandOnboardingStatus(profile: BrandProfile) {
  const offerCount = await prisma.offer.count({
    where: { brandId: profile.id },
  });

  const steps: OnboardingStep[] = [
    {
      key: "perfil",
      label: "Perfil del negocio",
      description: "",
      done: Boolean(
        profile.logoUrl && profile.description && profile.websiteUrl,
      ),
    },
    {
      key: "tienda",
      label: "Conectar tu tienda",
      description: "",
      done: profile.storeConnectionStatus === "CONNECTED",
    },
    {
      key: "pago",
      label: "Cómo te cobramos",
      description: "",
      done: Boolean(profile.billingAcknowledgedAt),
    },
    {
      key: "oferta",
      label: "Configura tu programa",
      description: "",
      done: offerCount > 0,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  return {
    steps,
    complete: completedCount === steps.length,
    completedCount,
    total: steps.length,
  };
}

/// SOLO PARA PRUEBAS — llena de una vez las mismas condiciones que
/// getBrandOnboardingStatus revisa arriba (perfil, tienda, cómo-te-cobramos,
/// oferta) para poder ver en vivo el portal de una marca "en vivo" (activa
/// en el marketplace, "Empieza aquí" fuera del sidebar, etc.) sin tener que
/// llenar cada paso del wizard a mano. Nunca se llama desde el onboarding
/// real — respeta lo que la marca ya haya completado (no pisa un logo o
/// tienda ya cargados) y solo rellena lo que falte.
export async function forceCompleteBrandOnboarding(brandId: string) {
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
  });

  await prisma.brandProfile.update({
    where: { id: brandId },
    data: {
      logoUrl: profile.logoUrl || "/marcolini-icon.png",
      description:
        profile.description ||
        `${profile.companyName} — marca de prueba, onboarding forzado desde el panel admin.`,
      websiteUrl: profile.websiteUrl || "https://marcolini.lat",
      storeConnectionStatus: "CONNECTED",
      storeUrl: profile.storeUrl || "https://tienda-de-prueba.myshopify.com",
      billingAcknowledgedAt: profile.billingAcknowledgedAt ?? new Date(),
    },
  });

  const offerCount = await prisma.offer.count({ where: { brandId } });
  if (offerCount === 0) {
    await prisma.offer.create({
      data: {
        brandId,
        name: "Programa de afiliados",
        defaultCommissionPercent: 8,
        defaultDiscountPercent: 10,
        joinMode: "OPEN",
      },
    });
  }
}
