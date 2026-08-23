import { prisma } from "@/lib/prisma";
import type { CreatorProfile } from "@prisma/client";

export type CreatorOnboardingStep = {
  key: string;
  label: string;
  description: string;
  done: boolean;
};

/// A diferencia del onboarding de marca, nada de esto bloquea nada — un
/// creador puede usar la plataforma completa sin tocar este wizard. Es
/// solo una guía con checkmarks para que sepa qué le falta si quiere sacarle
/// más provecho a su vitrina y a que le paguen sin contratiempos.
export async function getCreatorOnboardingStatus(profile: CreatorProfile) {
  const [interestCount, enrollmentCount] = await Promise.all([
    prisma.creatorInterest.count({ where: { creatorProfileId: profile.id } }),
    prisma.creatorOfferEnrollment.count({ where: { creatorId: profile.id } }),
  ]);

  const payoutReady =
    profile.payoutMethod === "BRE_B"
      ? Boolean(profile.breBKey)
      : profile.payoutMethod === "BANK"
        ? Boolean(profile.bankAccountNumber && profile.paymentHolderName)
        : false;

  const steps: CreatorOnboardingStep[] = [
    {
      key: "perfil",
      label: "Tu perfil",
      description: "Nombre completo, celular, redes sociales y categorías de interés.",
      done: Boolean(profile.legalName && profile.phone && interestCount > 0),
    },
    {
      key: "pago",
      label: "Cómo te pagamos",
      description: "Cédula y cuenta bancaria o llave Bre-B — el pago se hace manual, por transferencia.",
      done: Boolean(profile.documentId) && payoutReady,
    },
    {
      key: "marcas",
      label: "Únete a marcas",
      description: "Elige las marcas que quieres representar y empieza a generar comisión.",
      done: enrollmentCount > 0,
    },
    {
      key: "vitrina",
      label: "Tu vitrina",
      description: "Elige cómo se ve tu página pública y consigue tu link para compartir.",
      done: Boolean(profile.storefrontHeadline),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  return { steps, complete: completedCount === steps.length, completedCount, total: steps.length };
}
