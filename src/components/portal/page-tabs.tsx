import Link from "next/link";

/// Pestañas arriba de una sección del panel que agrupa varias rutas bajo
/// una sola entrada del menú lateral (ej. Configuración → General / Pagos
/// / Envíos, Creadores → Buscar / Vinculados). Cada pestaña es un link a
/// su ruta de siempre, así los links viejos no se rompen.
export function PageTabs({
  tabs,
  active,
}: {
  tabs: readonly { href: string; label: string }[];
  active: string;
}) {
  return (
    <div className="flex gap-1 border-b border-brand-line mb-6 overflow-x-auto">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
            tab.href === active
              ? "border-brand-accent text-brand-accent font-medium"
              : "border-transparent text-brand-ink-soft hover:text-brand-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
