import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkGoogleSignIn } from "@/server/services/google-sign-in";
import { hasDb } from "./helpers";

describe.skipIf(!hasDb)("entrar con Google", () => {
  it("entra a la cuenta que ya tiene ese correo y la deja confirmada", async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await prisma.user.create({ data: { email: `Marca-${suffix}@Prueba.test`, role: "BRAND" } });

    expect(await checkGoogleSignIn(`marca-${suffix}@prueba.test`, true)).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    // Igual al de Google, para que el adapter la encuentre y la ligue.
    expect(after.email).toBe(`marca-${suffix}@prueba.test`);
    expect(after.emailVerified).not.toBeNull();
  });

  it("sin cuenta no crea una: vuelve al login con el aviso", async () => {
    expect(await checkGoogleSignIn(`nadie-${randomUUID().slice(0, 8)}@prueba.test`, true)).toBe("/login?error=GoogleSinCuenta");
    expect(await checkGoogleSignIn(null, true)).toBe("/login?error=GoogleSinCorreo");
    expect(await checkGoogleSignIn("x@prueba.test", false)).toBe("/login?error=GoogleSinCorreo");
  });
});
