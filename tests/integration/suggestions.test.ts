import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { FileUploadError } from "@/lib/file-upload";
import { suggestionInputSchema } from "@/lib/suggestions";
import {
  countSuggestionsByStatus,
  createSuggestion,
  listMySuggestions,
  listSuggestionsForAdmin,
  senderName,
  setSuggestionStatus,
  SuggestionError,
} from "@/server/services/suggestion-service";
import { createBrand, hasDb } from "./helpers";

describe.skipIf(!hasDb)("buzón de sugerencias", () => {
  it("guarda el mensaje, le avisa al admin y la marca ve en qué va", async () => {
    const brand = await createBrand();
    const admin = await prisma.user.create({
      data: { email: `admin-${randomUUID().slice(0, 8)}@prueba.test`, role: "ADMIN", adminRole: "OWNER" },
    });
    const before = await countSuggestionsByStatus();

    const input = suggestionInputSchema.parse({ kind: "IDEA", message: "  Quiero ver mis ventas por creadora.  ", pagePath: "/marca/tienda" });
    const suggestion = await createSuggestion({ ...input, userId: brand.userId, portal: "BRAND", userAgent: "Prueba" });
    expect(suggestion).toMatchObject({ kind: "IDEA", message: "Quiero ver mis ventas por creadora.", pagePath: "/marca/tienda", status: "NEW", audioUrl: null });

    const notice = await prisma.notification.findFirstOrThrow({ where: { userId: admin.id, type: "SUGGESTION_ADMIN" } });
    expect(notice.message).toContain(`${brand.companyName} (marca) mandó una sugerencia: “Quiero ver mis ventas por creadora.”`);

    const [mine] = await listMySuggestions(brand.userId, "BRAND");
    expect(mine.id).toBe(suggestion.id);
    expect(await listMySuggestions(brand.userId, "CREATOR")).toEqual([]);

    const forAdmin = (await listSuggestionsForAdmin("NEW")).find((s) => s.id === suggestion.id);
    expect(forAdmin && senderName(forAdmin)).toBe(brand.companyName);

    await setSuggestionStatus(suggestion.id, "READ");
    const after = await countSuggestionsByStatus();
    expect(after.READ).toBe(before.READ + 1);
    expect(after.NEW).toBe(before.NEW);
    expect((await listMySuggestions(brand.userId, "BRAND"))[0].status).toBe("READ");
  });

  it("pide un mensaje o una nota de voz, y solo acepta audio", async () => {
    const brand = await createBrand();
    await expect(createSuggestion({ userId: brand.userId, portal: "BRAND" })).rejects.toBeInstanceOf(SuggestionError);
    const notAudio = new File(["hola"], "nota.txt", { type: "text/plain" });
    await expect(createSuggestion({ userId: brand.userId, portal: "BRAND", audio: notAudio })).rejects.toBeInstanceOf(FileUploadError);
    expect(await listMySuggestions(brand.userId, "BRAND")).toEqual([]);
    await expect(setSuggestionStatus(randomUUID(), "DONE")).rejects.toBeInstanceOf(SuggestionError);
  });

  it("no deja pasar rutas de afuera ni mensajes de más", () => {
    expect(suggestionInputSchema.parse({ message: "   ", pagePath: "https://otro.sitio" })).toEqual({ message: undefined, pagePath: undefined });
    expect(suggestionInputSchema.safeParse({ message: "x".repeat(4001) }).success).toBe(false);
  });
});
