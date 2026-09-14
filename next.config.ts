import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /// Sin esto, "next dev" devuelve 403 en los assets (_next/static/*)
  /// cuando se piden desde un subdominio de marca ({slug}.marcolini.lat)
  /// en vez de "localhost" — bloquea toda interactividad (agregar al
  /// carrito, variantes, etc.) en la vitrina pública al probarla
  /// localmente. Solo afecta al servidor de desarrollo, no a producción
  /// (ver node_modules/next/dist/docs/.../allowedDevOrigins.md).
  allowedDevOrigins: ["*.marcolini.lat"],
};

export default nextConfig;
