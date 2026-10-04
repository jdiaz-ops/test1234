import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createNotification, listNotifications } from "@/server/services/notification-service";
import { NOTIFICATION_TYPE_DEFAULTS } from "@/server/notification-types";
import { hasDb } from "./helpers";

async function createUser() {
  return prisma.user.create({ data: { email: `aviso-${randomUUID().slice(0, 8)}@prueba.test`, role: "CREATOR" } });
}

describe.skipIf(!hasDb)("notificaciones", () => {
  it("un tipo sin texto no crea una notificación vacía", async () => {
    const user = await createUser();
    const result = await createNotification(user.id, `TIPO_SIN_TEXTO_${randomUUID().slice(0, 6)}`, { marca: "X" });
    expect(result).toBeNull();
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0);
  });

  it("si el texto guardado está vacío usa el del catálogo", async () => {
    const def = NOTIFICATION_TYPE_DEFAULTS.find((d) => d.key === "SALE_COMMISSION")!;
    const user = await createUser();
    const key = `SALE_COMMISSION_PRUEBA_${randomUUID().slice(0, 6)}`;
    await prisma.notificationTypeConfig.create({
      data: { key, label: "Prueba", audience: def.audience, messageTemplate: "", placeholders: def.placeholders },
    });
    // Mismo texto por defecto que SALE_COMMISSION, a través de su clave.
    NOTIFICATION_TYPE_DEFAULTS.push({ ...def, key });
    try {
      const n = await createNotification(user.id, key, { marca: "H la Cosedora", monto: "$ 432" });
      expect(n?.message).toBe("¡Vendiste con tu código en H la Cosedora! Ganaste $ 432 de comisión.");
    } finally {
      NOTIFICATION_TYPE_DEFAULTS.pop();
      await prisma.notificationTypeConfig.delete({ where: { key } });
    }
  });

  it("la bandeja no muestra las vacías que ya existían", async () => {
    const user = await createUser();
    await prisma.notification.create({ data: { userId: user.id, type: "VIEJA", message: "", status: "SENT" } });
    await prisma.notification.create({ data: { userId: user.id, type: "VIEJA", message: "Hola", status: "SENT" } });
    const list = await listNotifications(user.id);
    expect(list.map((n) => n.message)).toEqual(["Hola"]);
  });
});
