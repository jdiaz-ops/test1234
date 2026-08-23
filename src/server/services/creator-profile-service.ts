import { prisma } from "@/lib/prisma";

export async function getCreatorProfileByUserId(userId: string) {
  return prisma.creatorProfile.findUniqueOrThrow({
    where: { userId },
    include: { socialLinks: true, vertical: true, interests: { include: { vertical: true } } },
  });
}

export async function updateCreatorProfile(
  userId: string,
  data: {
    displayName: string;
    legalName?: string;
    phone?: string;
    bio?: string;
    city?: string;
    verticalId?: string | null;
  }
) {
  return prisma.creatorProfile.update({
    where: { userId },
    data,
  });
}

export async function replaceSocialLinks(
  userId: string,
  links: { platform: string; handle: string; approxFollowers?: number | null }[]
) {
  const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId } });

  await prisma.$transaction([
    prisma.creatorSocialLink.deleteMany({ where: { creatorProfileId: profile.id } }),
    prisma.creatorSocialLink.createMany({
      data: links.map((l) => ({ ...l, creatorProfileId: profile.id })),
    }),
  ]);
}

/// Categorías de interés (multi-selección) — reemplaza el set completo cada
/// vez, más simple que calcular diffs y suficiente para un puñado de
/// categorías.
export async function replaceCreatorInterests(userId: string, verticalIds: string[]) {
  const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId } });

  await prisma.$transaction([
    prisma.creatorInterest.deleteMany({ where: { creatorProfileId: profile.id } }),
    ...(verticalIds.length > 0
      ? [
          prisma.creatorInterest.createMany({
            data: verticalIds.map((verticalId) => ({ creatorProfileId: profile.id, verticalId })),
          }),
        ]
      : []),
  ]);
}

export async function updatePaymentInfo(
  userId: string,
  data: {
    documentId?: string;
    payoutMethod: "BANK" | "BRE_B";
    breBKey?: string;
    bankName?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
    paymentHolderName?: string;
  }
) {
  return prisma.creatorProfile.update({
    where: { userId },
    data,
  });
}

/// Personalización de la vitrina — paleta/fuente (de la lista prearmada en
/// creator-storefront-themes.ts), título editable, y la bio corta opcional
/// que se muestra ahí (mismo campo que el resto del perfil, solo que se
/// ofrece en este paso en vez de como pregunta obligatoria).
export async function updateStorefrontSettings(
  userId: string,
  data: { storefrontPalette: string; storefrontFont: string; storefrontHeadline?: string; bio?: string }
) {
  return prisma.creatorProfile.update({
    where: { userId },
    data,
  });
}

/// Qué marcas se muestran en la vitrina y en qué orden — el creador decide.
export async function updateEnrollmentDisplay(
  userId: string,
  items: { enrollmentId: string; storefrontVisible: boolean; storefrontOrder: number }[]
) {
  const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId } });

  await prisma.$transaction(
    items.map((item) =>
      prisma.creatorOfferEnrollment.updateMany({
        // updateMany + creatorId en el where, no findUniqueOrThrow por id
        // suelto, para que un creador nunca pueda tocar la vitrina de otro
        // aunque mande un enrollmentId ajeno.
        where: { id: item.enrollmentId, creatorId: profile.id },
        data: { storefrontVisible: item.storefrontVisible, storefrontOrder: item.storefrontOrder },
      })
    )
  );
}

export async function markTermsAccepted(userId: string) {
  return prisma.creatorProfile.update({
    where: { userId },
    data: { termsAcceptedAt: new Date() },
  });
}
