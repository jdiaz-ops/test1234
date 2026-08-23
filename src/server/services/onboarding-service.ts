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
  const offerCount = await prisma.offer.count({ where: { brandId: profile.id } });

  const steps: OnboardingStep[] = [
    {
      key: "perfil",
      label: "Perfil del negocio",
      description: "Logo, descripción y página web — así te ven los creadores en el marketplace.",
      done: Boolean(profile.logoUrl && profile.description && profile.websiteUrl),
    },
    {
      key: "tienda",
      label: "Conectar tu tienda",
      description: "Shopify o WooCommerce — sin esto no podemos rastrear las ventas de tus creadores.",
      done: profile.storeConnectionStatus === "CONNECTED",
    },
    {
      key: "pago",
      label: "Cómo te cobramos",
      description:
        "El día 1 de cada mes te mandamos el corte (comisión de tus creadores + tarifa de Marcolini) para pagar por transferencia — sin tarjeta ni procesador de por medio.",
      done: Boolean(profile.billingAcknowledgedAt),
    },
    {
      key: "oferta",
      label: "Configura tu programa de afiliados",
      description: "Define la comisión para el creador y el descuento para tu cliente.",
      done: offerCount > 0,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  return { steps, complete: completedCount === steps.length, completedCount, total: steps.length };
}
