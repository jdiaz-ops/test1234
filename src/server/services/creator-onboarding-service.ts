import { prisma } from "@/lib/prisma";
import type { CreatorProfile } from "@prisma/client";
import { createNotification } from "@/server/services/notification-service";
import { sendOnboardingReminderEmail } from "@/lib/email";

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
      description: "",
      done: interestCount > 0,
    },
    {
      key: "pago",
      label: "Cómo te pagamos",
      description: "",
      done:
        Boolean(profile.legalName && profile.phone && profile.documentId) &&
        payoutReady,
    },
    {
      key: "marcas",
      label: "Únete a marcas",
      description: "",
      done: enrollmentCount > 0,
    },
    {
      key: "vitrina",
      label: "Tu vitrina",
      description: "",
      done: Boolean(profile.storefrontHeadline),
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

const REMINDER_1_DAYS = 3;
const REMINDER_2_DAYS = 7;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/// Empujoncito no bloqueante para terminar el onboarding — a los 3 y 7 días
/// de registrarse, si todavía no lo completó, sin importar si en el medio
/// dejó de usar la plataforma. Si para cuando le toca ya lo completó, no se
/// le manda nada — se marca igual como "usado" para no volver a evaluarlo
/// cada día. Corre dentro del cron diario, mismo patrón que
/// sendChallengeUrgencyReminders.
export async function sendOnboardingReminders() {
  const round1 = await prisma.creatorProfile.findMany({
    where: {
      createdAt: { lte: daysAgo(REMINDER_1_DAYS) },
      onboardingReminder1SentAt: null,
    },
    include: { user: true },
  });
  const round2 = await prisma.creatorProfile.findMany({
    where: {
      createdAt: { lte: daysAgo(REMINDER_2_DAYS) },
      onboardingReminder2SentAt: null,
    },
    include: { user: true },
  });

  const sent1 = await processReminderRound(
    round1,
    "onboardingReminder1SentAt",
    1,
  );
  const sent2 = await processReminderRound(
    round2,
    "onboardingReminder2SentAt",
    2,
  );

  return { sentCount: sent1 + sent2 };
}

async function processReminderRound(
  candidates: (CreatorProfile & { user: { email: string } })[],
  field: "onboardingReminder1SentAt" | "onboardingReminder2SentAt",
  round: 1 | 2,
) {
  let sentCount = 0;

  for (const profile of candidates) {
    const status = await getCreatorOnboardingStatus(profile);
    const now = new Date();

    if (status.complete) {
      await prisma.creatorProfile.update({
        where: { id: profile.id },
        data: { [field]: now },
      });
      continue;
    }

    const missingLabels = status.steps
      .filter((s) => !s.done)
      .map((s) => s.label);

    await createNotification(
      profile.userId,
      round === 1 ? "ONBOARDING_REMINDER_1" : "ONBOARDING_REMINDER_2",
      { faltantes: missingLabels.join(", ") },
      () =>
        sendOnboardingReminderEmail(profile.user.email, {
          displayName: profile.displayName,
          missingLabels,
          round,
        }),
    );

    await prisma.creatorProfile.update({
      where: { id: profile.id },
      data: { [field]: now },
    });
    sentCount++;
  }

  return sentCount;
}
