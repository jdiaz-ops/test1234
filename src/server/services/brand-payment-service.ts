import { prisma } from "@/lib/prisma";

/// Guarda las llaves de Wompi que la marca pegó desde su propio panel — se
/// activa como pasarela (paymentProvider = WOMPI) apenas guarda algo, aunque
/// todavía no haya cargado las 4 llaves completas; el checkout real (cuando
/// exista) es el que exige que estén completas para el modo elegido antes de
/// dejar cobrar — ver getWompiCredentialsStatus.
export async function saveWompiCredentials(
  userId: string,
  data: {
    paymentMode: "TEST" | "PRODUCTION";
    wompiPublicKeyTest?: string;
    wompiPrivateKeyTest?: string;
    wompiEventsKeyTest?: string;
    wompiIntegrityKeyTest?: string;
    wompiPublicKeyProd?: string;
    wompiPrivateKeyProd?: string;
    wompiEventsKeyProd?: string;
    wompiIntegrityKeyProd?: string;
  },
) {
  return prisma.brandProfile.update({
    where: { userId },
    data: {
      paymentProvider: "WOMPI",
      paymentMode: data.paymentMode,
      wompiPublicKeyTest: data.wompiPublicKeyTest || null,
      wompiPrivateKeyTest: data.wompiPrivateKeyTest || null,
      wompiEventsKeyTest: data.wompiEventsKeyTest || null,
      wompiIntegrityKeyTest: data.wompiIntegrityKeyTest || null,
      wompiPublicKeyProd: data.wompiPublicKeyProd || null,
      wompiPrivateKeyProd: data.wompiPrivateKeyProd || null,
      wompiEventsKeyProd: data.wompiEventsKeyProd || null,
      wompiIntegrityKeyProd: data.wompiIntegrityKeyProd || null,
    },
  });
}

/// Las 4 llaves que hacen falta para el modo activo (test o producción) —
/// el checkout de "Mi tienda" (cuando exista) usa esto para decidir si ya
/// puede cobrar de verdad o si a la marca todavía le falta completar algo.
export function isWompiModeComplete(profile: {
  paymentMode: "TEST" | "PRODUCTION";
  wompiPublicKeyTest: string | null;
  wompiPrivateKeyTest: string | null;
  wompiEventsKeyTest: string | null;
  wompiIntegrityKeyTest: string | null;
  wompiPublicKeyProd: string | null;
  wompiPrivateKeyProd: string | null;
  wompiEventsKeyProd: string | null;
  wompiIntegrityKeyProd: string | null;
}) {
  const keys =
    profile.paymentMode === "TEST"
      ? [
          profile.wompiPublicKeyTest,
          profile.wompiPrivateKeyTest,
          profile.wompiEventsKeyTest,
          profile.wompiIntegrityKeyTest,
        ]
      : [
          profile.wompiPublicKeyProd,
          profile.wompiPrivateKeyProd,
          profile.wompiEventsKeyProd,
          profile.wompiIntegrityKeyProd,
        ];
  return keys.every((k) => Boolean(k));
}
