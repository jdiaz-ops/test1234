import { describe, expect, it } from "vitest";
import { isValidMetaPixelId, isValidTiktokPixelId, parseMetaPixelId, parseTiktokPixelId } from "@/lib/ad-pixels";

describe("Pixel ID de Meta", () => {
  it("acepta el número solo, con espacios alrededor", () => {
    expect(parseMetaPixelId("  1234567890123456 ")).toBe("1234567890123456");
  });
  it("lo saca del código completo que da Meta", () => {
    const snippet = `<script>!function(f,b,e,v,n,t,s){...}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '987654321098765');
fbq('track', 'PageView');</script>`;
    expect(parseMetaPixelId(snippet)).toBe("987654321098765");
  });
  it("vacío = quitar el pixel", () => {
    expect(parseMetaPixelId("   ")).toBe("");
  });
  it("rechaza lo que no son solo números (no puede colarse código)", () => {
    expect(parseMetaPixelId("123'); alert(1);//")).toBeNull();
    expect(parseMetaPixelId("abc123")).toBeNull();
    expect(parseMetaPixelId("123")).toBeNull();
    expect(isValidMetaPixelId("1234567890');x")).toBe(false);
  });
});

describe("Pixel ID de TikTok", () => {
  it("acepta el código solo", () => {
    expect(parseTiktokPixelId("CABC123DEF456GHI789J0")).toBe("CABC123DEF456GHI789J0");
  });
  it("lo saca del código completo que da TikTok", () => {
    const snippet = `ttq.load('CXYZ987LMN654OPQ321R0');\n  ttq.page();`;
    expect(parseTiktokPixelId(snippet)).toBe("CXYZ987LMN654OPQ321R0");
  });
  it("rechaza símbolos (no puede colarse código)", () => {
    expect(parseTiktokPixelId("CABC123\"</script>")).toBeNull();
    expect(parseTiktokPixelId("short")).toBeNull();
    expect(isValidTiktokPixelId("CABC123DEF456');x")).toBe(false);
  });
});
