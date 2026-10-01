import { PageTabs } from "@/components/portal/page-tabs";

const tabs = {
  buscar: { href: "/marca/creadores/buscar", label: "Buscar creadores" },
  vinculados: { href: "/marca/creadores", label: "Vinculados" },
} as const;

/// Pestañas de Creadores: Buscar y Vinculados. Antes eran dos entradas
/// sueltas del menú lateral; la marca pidió unificarlas el 2026-10-01.
export function CreatorsTabs({ active }: { active: keyof typeof tabs }) {
  return <PageTabs tabs={Object.values(tabs)} active={tabs[active].href} />;
}
