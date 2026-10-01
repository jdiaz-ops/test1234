import Link from "next/link";

const tabs = [
  { key: "general", href: "/marca/tienda/configuracion", label: "General" },
  { key: "pagos", href: "/marca/tienda/pagos", label: "Pagos" },
  { key: "envios", href: "/marca/tienda/envios", label: "Envíos" },
] as const;

/// Pestañas de Configuración: General (link, dominio, IVA), Pagos y
/// Envíos. Pagos y Envíos salieron del menú lateral y viven acá — pedido
/// de la marca el 2026-10-01. Las rutas siguen siendo las mismas, así que
/// los links viejos no se rompen.
export function StoreSettingsTabs({ active }: { active: (typeof tabs)[number]["key"] }) {
  return (
    <div className="flex gap-1 border-b border-brand-line mb-6 overflow-x-auto">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
            tab.key === active
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
