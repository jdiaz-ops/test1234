import NextLink from "next/link";
import type { ComponentProps } from "react";

/// El Link de la tienda: no se carga solo cuando aparece en pantalla (el
/// prefetch de Next.js), sino al tocarlo. Cada link precargado era una
/// visita entera al servidor, y Prisma Postgres cobra cada consulta: abrir
/// un producto con 20 más abajo gastaba 85 consultas en vez de 17 (medido
/// el 2026-10-23, cuando se acabó el plan gratis y la base se bloqueó).
export default function StoreLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
