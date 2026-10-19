import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { GOOGLE_FONT_OPTIONS } from "@/lib/brand-theme";
import { BANNER_SIZES, mix, readableOn, verifyBanner, type BannerSpec } from "@/lib/banner-image";
import { safeFetch } from "@/server/integrations/safe-fetch";

/// Pinta un banner con el estilo de la tienda (ver src/lib/banner-image.ts):
/// fondo con los colores del tema, el título con la letra del tema y la
/// foto de la colección a un lado (formato ancho, para computador) o
/// arriba (formato cuadrado, para celular, donde el texto de un banner
/// ancho quedaría ilegible). Solo acepta recetas firmadas, y la foto se
/// baja con los mismos cuidados que cualquier dirección externa
/// (safeFetch) y se incrusta, así el pintor nunca sale a buscar lo que le
/// pidan. La respuesta se guarda en el CDN: la misma receta da siempre el
/// mismo banner.
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

/// El archivo de la letra (TTF) desde Google Fonts — con un User-Agent
/// viejo, Google devuelve TTF en vez de WOFF2 (que satori no lee).
async function loadFont(family: string): Promise<ArrayBuffer | null> {
  const option = GOOGLE_FONT_OPTIONS.find((f) => f.value === family);
  if (!option) return null;
  const key = option.value;
  if (!fontCache.has(key)) {
    fontCache.set(
      key,
      (async () => {
        try {
          const weight = option.weights.split(";").map(Number).filter(Boolean).sort((a, b) => b - a)[0] ?? 600;
          const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(key)}:wght@${weight}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0" },
            signal: AbortSignal.timeout(8000),
          }).then((r) => (r.ok ? r.text() : ""));
          const url = css.match(/src:\s*url\((https:[^)]+\.(?:ttf|otf))\)/)?.[1];
          if (!url) return null;
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
          return res.ok ? res.arrayBuffer() : null;
        } catch {
          return null;
        }
      })(),
    );
  }
  return fontCache.get(key)!;
}

async function loadImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await safeFetch(url, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 8000, accept: "image/*" });
    if (res.status !== 200 || !res.contentType.startsWith("image/")) return null;
    return `data:${res.contentType};base64,${res.body.toString("base64")}`;
  } catch {
    return null;
  }
}

type Props = { spec: BannerSpec; image: string | null };

/// Sin foto, el formato de celular queda más bajo (solo el texto).
const MOBILE_TEXT_ONLY_HEIGHT = 640;

function sizeOf(spec: BannerSpec, image: string | null) {
  const size = BANNER_SIZES[spec.layout];
  return spec.layout === "mobile" && !image ? { ...size, height: MOBILE_TEXT_ONLY_HEIGHT } : size;
}

/// Título, bajada y "botón" en columna (satori necesita un contenedor
/// flex explícito; un fragmento los pone en fila).
function Texts({ spec, titleSize, subtitleSize, ctaSize }: { spec: BannerSpec; titleSize: number; subtitleSize: number; ctaSize: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {spec.title && <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>{spec.title}</div>}
      {spec.subtitle && <div style={{ fontSize: subtitleSize, lineHeight: 1.3, marginTop: Math.round(subtitleSize * 0.7), opacity: 0.8 }}>{spec.subtitle}</div>}
      {spec.cta && (
        <div style={{ display: "flex", marginTop: Math.round(ctaSize * 1.4) }}>
          <div style={{ backgroundColor: spec.accent, color: readableOn(spec.accent), fontSize: ctaSize, fontWeight: 600, padding: `${Math.round(ctaSize * 0.7)}px ${Math.round(ctaSize * 1.7)}px`, borderRadius: 999 }}>
            {spec.cta}
          </div>
        </div>
      )}
    </div>
  );
}

/// Computador: texto a la izquierda, foto a la derecha.
function Wide({ spec, image }: Props) {
  const { width, height } = BANNER_SIZES.wide;
  const wash = mix(spec.bg, spec.accent, 0.12);
  const textWidth = image ? 880 : width;
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        backgroundColor: spec.bg,
        backgroundImage: `linear-gradient(110deg, ${spec.bg} 0%, ${spec.bg} 45%, ${wash} 100%)`,
        fontFamily: spec.font,
        color: spec.fg,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: textWidth, padding: "0 96px" }}>
        <Texts spec={spec} titleSize={72} subtitleSize={30} ctaSize={26} />
      </div>
      {image && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: width - textWidth, height, padding: "48px 72px 48px 0" }}>
          <div style={{ display: "flex", width: "100%", height: "100%", borderRadius: 36, overflow: "hidden", backgroundColor: wash }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori pinta la foto incrustada */}
            <img src={image} alt="" width={width - textWidth - 72} height={height - 96} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
      )}
    </div>
  );
}

/// Celular: foto arriba, texto abajo, con letra grande para una pantalla
/// angosta (el banner se ve a unos 400 px de ancho).
function Mobile({ spec, image }: Props) {
  const { width, height } = sizeOf(spec, image);
  const wash = mix(spec.bg, spec.accent, 0.12);
  const padding = 64;
  const photoHeight = 500;
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: spec.bg,
        backgroundImage: `linear-gradient(165deg, ${spec.bg} 0%, ${spec.bg} 40%, ${wash} 100%)`,
        fontFamily: spec.font,
        color: spec.fg,
        padding,
      }}
    >
      {image && (
        <div style={{ display: "flex", width: "100%", height: photoHeight, borderRadius: 36, overflow: "hidden", backgroundColor: wash }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori pinta la foto incrustada */}
          <img src={image} alt="" width={width - padding * 2} height={photoHeight} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, paddingTop: image ? 44 : 0 }}>
        <Texts spec={spec} titleSize={image ? 66 : 84} subtitleSize={34} ctaSize={30} />
      </div>
    </div>
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  let spec: BannerSpec | null;
  try {
    spec = verifyBanner(url.searchParams.get("s") ?? "", url.searchParams.get("sig") ?? "");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo pintar el banner." }, { status: 500 });
  }
  if (!spec) return NextResponse.json({ error: "Banner no válido." }, { status: 404 });

  const [image, font] = await Promise.all([loadImage(spec.image), loadFont(spec.font)]);
  const fonts = font ? [{ name: spec.font, data: font, weight: 700 as const, style: "normal" as const }] : undefined;
  const element = spec.layout === "mobile" ? <Mobile spec={spec} image={image} /> : <Wide spec={spec} image={image} />;
  const response = new ImageResponse(element, { ...sizeOf(spec, image), fonts });
  response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return response;
}
