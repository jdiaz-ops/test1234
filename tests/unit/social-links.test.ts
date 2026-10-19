import { describe, expect, it } from "vitest";
import { socialProfileUrl, sortSocialLinks } from "@/lib/social-links";

describe("links a las redes de una creadora", () => {
  it("arma el link de cada red con o sin @, y respeta un link completo", () => {
    expect(socialProfileUrl("Instagram", "@laura.nails")).toBe("https://www.instagram.com/laura.nails");
    expect(socialProfileUrl("TikTok", "laura_nails")).toBe("https://www.tiktok.com/@laura_nails");
    expect(socialProfileUrl("YouTube", "youtube.com/@laura")).toBe("https://youtube.com/@laura");
    expect(socialProfileUrl("Blog o web", "https://laura.com")).toBe("https://laura.com");
    expect(socialProfileUrl("Otra", "laura")).toBeNull();
    expect(socialProfileUrl("Instagram", "  ")).toBeNull();
  });

  it("pone primero Instagram, TikTok y YouTube", () => {
    expect(sortSocialLinks([{ platform: "Facebook" }, { platform: "YouTube" }, { platform: "Instagram" }, { platform: "TikTok" }]).map((l) => l.platform)).toEqual([
      "Instagram",
      "TikTok",
      "YouTube",
      "Facebook",
    ]);
  });
});
