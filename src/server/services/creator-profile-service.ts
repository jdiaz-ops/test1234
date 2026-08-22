import { prisma } from "@/lib/prisma";

export async function getCreatorProfileByUserId(userId: string) {
  return prisma.creatorProfile.findUniqueOrThrow({
    where: { userId },
    include: { socialLinks: true, vertical: true },
  });
}

export async function updateCreatorProfile(
  userId: string,
  data: {
    displayName: string;
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

export async function updatePaymentInfo(
  userId: string,
  data: {
    bankName: string;
    bankAccountType: string;
    bankAccountNumber: string;
    paymentHolderName: string;
  }
) {
  return prisma.creatorProfile.update({
    where: { userId },
    data,
  });
}
