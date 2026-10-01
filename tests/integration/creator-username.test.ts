import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CreatorProfileError, updateCreatorProfile } from "@/server/services/creator-profile-service";
import { hasDb } from "./helpers";

describe.skipIf(!hasDb)("username del creador", () => {
  it("se confirma al guardar el perfil (rehace vitrina y código) y después queda fijo", async () => {
    const suffix = randomUUID().slice(0, 6);
    const user = await prisma.user.create({ data: { email: `u-${suffix}@prueba.test`, role: "CREATOR" } });
    await prisma.creatorProfile.create({
      data: { userId: user.id, displayName: "Viejo", baseCode: `VIEJO${suffix}`, storefrontSlug: `viejo-${suffix}` },
    });

    const name = `Nail Fest ${suffix}`;
    const updated = await updateCreatorProfile(user.id, { displayName: name });
    expect(updated.displayNameLockedAt).not.toBeNull();
    expect(updated.storefrontSlug).toBe(`nail-fest-${suffix}`);
    expect(updated.baseCode).toBe(`NAILFEST${suffix.toUpperCase()}`);

    // Mismo nombre: se puede seguir guardando el resto del perfil.
    await expect(updateCreatorProfile(user.id, { displayName: name, bio: "Hola" })).resolves.toBeTruthy();
    await expect(updateCreatorProfile(user.id, { displayName: "Otro" })).rejects.toBeInstanceOf(CreatorProfileError);
  });
});
