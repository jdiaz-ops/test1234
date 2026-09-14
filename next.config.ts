import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // isomorphic-dompurify (sanea la Descripción de producto — ver
  // sanitize-html.ts) trae jsdom, que no se puede empaquetar para el
  // runtime de servidor de Next — hay que dejarlo externo o rompe en
  // producción (Vercel) aunque funcione en `next dev`. Ver
  // conversación del 2026-09-14: "la única página que no carga" era
  // justo la que importa esto (productos).
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],
};

export default nextConfig;
