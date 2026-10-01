import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { creatorWaitlistSchema, parseAttributionCookie, socialsText } from "@/lib/waitlist";
import { joinCreatorWaitlist } from "@/server/services/waitlist-service";
import { hasDb } from "./helpers";

const input = (email: string) =>
  creatorWaitlistSchema.parse({
    name: "Laura",
    email,
    whatsapp: "300 123 4567",
    socials: [
      { platform: "Instagram", handle: "@laura.nails" },
      { platform: "TikTok", handle: "" },
      { platform: "YouTube", handle: "youtube.com/@laura" },
    ],
    audience: "1.000 a 10.000",
    category: "Uñas",
  });

describe("formulario de lista de espera", () => {
  it("pide WhatsApp y opciones válidas", () => {
    const bad = creatorWaitlistSchema.safeParse({ ...input("a@b.co"), whatsapp: "12", audience: "mil" });
    expect(bad.success).toBe(false);
  });

  it("pide al menos una red y descarta las vacías", () => {
    expect(input("a@b.co").socials).toEqual([
      { platform: "Instagram", handle: "laura.nails" },
      { platform: "YouTube", handle: "youtube.com/@laura" },
    ]);
    expect(socialsText(input("a@b.co").socials)).toBe("Instagram: @laura.nails · YouTube: youtube.com/@laura");
    const none = creatorWaitlistSchema.safeParse({
      ...input("a@b.co"),
      socials: [{ platform: "Instagram", handle: " @ " }],
    });
    expect(none.success).toBe(false);
  });

  it("lee la cookie del anuncio sin confiar en su contenido", () => {
    const cookie = encodeURIComponent(JSON.stringify({ utm_source: "instagram", utm_campaign: "lanzamiento", x: 1 }));
    expect(parseAttributionCookie(cookie)).toMatchObject({ utmSource: "instagram", utmCampaign: "lanzamiento" });
    expect(parseAttributionCookie("%%no-json")).toEqual({});
  });
});

describe.skipIf(!hasDb)("lista de espera", () => {
  it("inscribe una vez por correo y conserva el anuncio que lo trajo primero", async () => {
    const email = `Creador-${randomUUID().slice(0, 8)}@Prueba.test`;
    expect(await joinCreatorWaitlist(input(email), { utmSource: "instagram", utmCampaign: "oct" })).toEqual({
      alreadyJoined: false,
    });
    expect(
      await joinCreatorWaitlist({ ...input(email.toLowerCase()), name: "Laura M" }, { utmSource: "tiktok" }),
    ).toEqual({ alreadyJoined: true });

    const rows = await prisma.waitlistEntry.findMany({ where: { email: email.toLowerCase() } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Laura M", utmSource: "instagram", utmCampaign: "oct" });
    expect(rows[0].socials).toEqual(input(email).socials);
  });
});
