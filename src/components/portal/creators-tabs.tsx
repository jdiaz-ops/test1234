import { PageTabs } from "@/components/portal/page-tabs";

const tabs = {
  vinculados: { href: "/marca/creadores", label: "Vinculados" },
  buscar: { href: "/marca/creadores/buscar", label: "Buscar creadores" },
} as const;

/// Pestañas de Creadores: Vinculados (primero, pedido de la marca el
/// 2026-10-01) y Buscar. Antes eran dos entradas sueltas del menú lateral.
export function CreatorsTabs({ active }: { active: keyof typeof tabs }) {
  return <PageTabs tabs={Object.values(tabs)} active={tabs[active].href} />;
}
