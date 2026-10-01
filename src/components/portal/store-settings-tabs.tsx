import { PageTabs } from "@/components/portal/page-tabs";

const tabs = {
  general: { href: "/marca/tienda/configuracion", label: "General" },
  pagos: { href: "/marca/tienda/pagos", label: "Pagos" },
  envios: { href: "/marca/tienda/envios", label: "Envíos" },
} as const;

/// Pestañas de Configuración: General (link, dominio, IVA), Pagos y
/// Envíos. Pagos y Envíos salieron del menú lateral y viven acá — pedido
/// de la marca el 2026-10-01.
export function StoreSettingsTabs({ active }: { active: keyof typeof tabs }) {
  return <PageTabs tabs={Object.values(tabs)} active={tabs[active].href} />;
}
