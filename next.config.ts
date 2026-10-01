import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /// Sin esto, "next dev" devuelve 403 en los assets (_next/static/*)
  /// cuando se piden desde un subdominio de marca ({slug}.marcolini.lat)
  /// en vez de "localhost" — bloquea toda interactividad (agregar al
  /// carrito, variantes, etc.) en la vitrina pública al probarla
  /// localmente. Solo afecta al servidor de desarrollo, no a producción
  /// (ver node_modules/next/dist/docs/.../allowedDevOrigins.md).
  allowedDevOrigins: ["*.marcolini.lat"],

  /// Fotos de la vitrina (ver src/components/storefront/store-image.tsx):
  /// solo se optimizan las que vienen de Vercel Blob (lo que suben las
  /// marcas) y del CDN de Shopify (productos importados). Caché de 31 días:
  /// los archivos subidos no cambian (cada subida tiene su propio nombre),
  /// así que no vale la pena volver a procesarlos. Ver conversación del
  /// 2026-10-01.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
    minimumCacheTTL: 2678400,
  },
};

export default nextConfig;
