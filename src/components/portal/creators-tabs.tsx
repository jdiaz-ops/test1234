import { PageTabs } from "@/components/portal/page-tabs";

const tabs = {
  buscar: { href: "/marca/creadores/buscar", label: "Buscar creadores" },
  vinculados: { href: "/marca/creadores", label: "Vinculados" },
} as const;

/// Pestañas de Creadores: primero Buscar y después Vinculados (pedido del
/// 2026-10-19; antes Vinculados iba primero, 2026-10-01). Antes eran dos
/// entradas sueltas del menú lateral.
export function CreatorsTabs({ active }: { active: keyof typeof tabs }) {
  return <PageTabs tabs={Object.values(tabs)} active={tabs[active].href} />;
}
