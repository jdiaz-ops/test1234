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
