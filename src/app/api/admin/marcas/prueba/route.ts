import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { prisma } from "@/lib/prisma";

const NOMBRES = ["Marca Uno Prueba", "Marca Dos Prueba", "Marca Tres Prueba", "Marca Cuatro Prueba"];

/// Crea (o completa) 4 marcas de mentira para que el Propietario pueda
/// probar el marketplace y el portal de marca con "Entrar como" — cada una
/// queda ya Aprobada y con una oferta activa, sin mandar ningún correo (no
/// hace falta, nunca se entra a estas cuentas con contraseña). Es idempotente:
/// si ya existen (mismo correo), no las duplica.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const created: string[] = [];
  const yaExistian: string[] = [];

  for (let i = 0; i < NOMBRES.length; i++) {
    const email = `marca-prueba-${i + 1}@marcolini.test`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      yaExistian.push(NOMBRES[i]);
      continue;
    }

    await prisma.user.create({
      data: {
        email,
        role: "BRAND",
        emailVerified: new Date(),
        brandProfile: {
          create: {
            companyName: NOMBRES[i],
            status: "APPROVED",
            approvedAt: new Date(),
            termsAcceptedAt: new Date(),
            offers: {
              create: {
                name: "Oferta de prueba",
                defaultCommissionPercent: 10,
                defaultDiscountPercent: 10,
                joinMode: "OPEN",
                status: "ACTIVE",
              },
            },
          },
        },
      },
    });
    created.push(NOMBRES[i]);
  }

  return NextResponse.json({ ok: true, created, yaExistian });
}
