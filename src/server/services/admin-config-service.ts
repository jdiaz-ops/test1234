import { prisma } from "@/lib/prisma";

export async function getPlatformConfig() {
  return prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
}

export async function updatePlatformConfig(data: {
  defaultPlatformFeePercent: number;
  vatPercent: number;
  chargeDayOfMonth: number;
  payoutDayOfMonth: number;
  refundHoldDays: number;
  instantPayoutFeePercent: number;
  paymentInstructions?: string;
  paymentGraceHours?: number;
}) {
  return prisma.platformConfig.update({ where: { id: "singleton" }, data });
}

export async function updatePlatformPaymentQrImage(paymentQrImageUrl: string) {
  return prisma.platformConfig.update({ where: { id: "singleton" }, data: { paymentQrImageUrl } });
}

export async function getLegalContent(key: string) {
  return prisma.legalContent.findUnique({ where: { key } });
}

export async function upsertLegalContent(key: string, title: string, body: string) {
  return prisma.legalContent.upsert({
    where: { key },
    update: { title, body },
    create: { key, title, body },
  });
}
