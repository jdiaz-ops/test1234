import { prisma } from "@/lib/prisma";

export async function listCreators() {
  return prisma.creatorProfile.findMany({
    include: { vertical: true, _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function setCreatorSuspended(creatorId: string, suspended: boolean) {
  const creator = await prisma.creatorProfile.update({
    where: { id: creatorId },
    data: { suspended },
  });
  await prisma.notification.create({
    data: {
      userId: creator.userId,
      type: suspended ? "account_suspended" : "account_reactivated",
      message: suspended
        ? "Tu cuenta fue suspendida. Contáctanos si crees que es un error."
        : "Tu cuenta fue reactivada.",
    },
  });
  return creator;
}
