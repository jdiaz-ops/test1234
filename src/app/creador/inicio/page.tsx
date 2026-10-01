import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorOnboardingStatus } from "@/server/services/creator-onboarding-service";

/// A dónde entra el creador después de iniciar sesión: a "Empieza aquí"
/// mientras no haya terminado su onboarding, si no al Dashboard. Ver
/// conversación del 2026-10-01 (un creador nuevo caía en un Dashboard
/// vacío). El Dashboard sigue abierto desde el menú en cualquier momento.
export default async function CreadorInicioPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CREATOR") redirect("/login");
  const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: session.user.id } });
  const onboarding = await getCreatorOnboardingStatus(profile);
  redirect(onboarding.complete ? "/creador" : "/creador/onboarding");
}
