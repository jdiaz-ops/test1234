import Link from "next/link";

/// Pestañas de una sección del portal de marca (Tienda, Configuración):
/// una fila de botones arriba, que en el celular se desliza. Arriba y no a
/// un lado, para que lo de adentro (el editor de Diseño, las tablas) use
/// todo el ancho — pedido del 2026-10-20: "crea configuración con las
/// pestañas así como en tienda".
export function SectionTabs({
  label,
  tabs,
  active,
}: {
  label: string;
  tabs: { key: string; href: string; label: string }[];
  active: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto overflow-y-hidden -mx-1 px-1 pb-1 mb-6">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
            t.key === active
              ? "bg-brand-accent-soft text-brand-accent font-medium"
              : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
