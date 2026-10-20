import Link from "next/link";
import { REVIEWS_ENABLED } from "@/lib/features";

/// Tienda: lo que arma la vitrina — productos, colecciones, diseño y
/// páginas — en una sola entrada del menú con pestañas, presentadas como
/// las de Configuración (pedido del 2026-10-20: "los pasas en una pestaña
/// que se llama tienda"; antes iban adentro de Configuración). Las
/// pestañas van arriba y no a un lado para que el editor de Diseño y la
/// lista de productos usen todo el ancho. Cada sección sigue en su ruta de
/// siempre, así los links viejos no se rompen.
export const STORE_SECTIONS = {
  productos: { href: "/marca/tienda/productos", label: "Productos" },
  colecciones: { href: "/marca/tienda/colecciones", label: "Colecciones" },
  diseno: { href: "/marca/tienda/diseno", label: "Diseño" },
  paginas: { href: "/marca/tienda/paginas", label: "Páginas" },
  /// Solo con REVIEWS_ENABLED (src/lib/features.ts).
  resenas: { href: "/marca/tienda/resenas", label: "Reseñas" },
} as const;

export type StoreSection = keyof typeof STORE_SECTIONS;

const visibleSections = (Object.entries(STORE_SECTIONS) as [StoreSection, (typeof STORE_SECTIONS)[StoreSection]][]).filter(
  ([key]) => REVIEWS_ENABLED || key !== "resenas",
);

/// Rutas que cuentan como "Tienda" en el menú lateral (también sus
/// subpáginas, ej. editar un producto).
export const STORE_PATHS: string[] = visibleSections.map(([, s]) => s.href);

export function StoreShell({ active, children }: { active: StoreSection; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">TIENDA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">Tienda</h1>
      {/* En el celular, una fila deslizable, igual que en Configuración. */}
      <nav aria-label="Secciones de la tienda" className="flex gap-1 overflow-x-auto overflow-y-hidden -mx-1 px-1 pb-1 mb-6">
        {visibleSections.map(([key, s]) => (
          <Link
            key={key}
            href={s.href}
            aria-current={key === active ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
              key === active
                ? "bg-brand-accent-soft text-brand-accent font-medium"
                : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
