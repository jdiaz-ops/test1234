import Link from "next/link";

/// Configuración de la marca: una sola entrada del menú con todo lo que
/// antes estaba repartido entre "Cuenta" y "Mi tienda → Configuración"
/// (pedido de la marca el 2026-10-01, estilo Shopify). Cada sección sigue
/// viviendo en su ruta de siempre, así los links viejos no se rompen.
export const SETTINGS_SECTIONS = {
  general: { href: "/marca/tienda/configuracion", label: "General" },
  programa: { href: "/marca/cuenta?tab=oferta", label: "Programa de creadores" },
  pagos: { href: "/marca/tienda/pagos", label: "Pagos de la tienda" },
  envios: { href: "/marca/tienda/envios", label: "Envíos" },
  conexiones: { href: "/marca/tienda/conexiones", label: "Conexiones" },
  pixeles: { href: "/marca/tienda/pixeles", label: "Píxeles de anuncios" },
  facturacion: { href: "/marca/cuenta?tab=pago", label: "Plan y facturación" },
  seguridad: { href: "/marca/cuenta?tab=seguridad", label: "Seguridad" },
} as const;

export type SettingsSection = keyof typeof SETTINGS_SECTIONS;

/// Rutas que cuentan como "Configuración" en el menú lateral.
export const SETTINGS_PATHS = [
  "/marca/tienda/configuracion",
  "/marca/tienda/pagos",
  "/marca/tienda/envios",
  "/marca/tienda/conexiones",
  "/marca/tienda/pixeles",
  "/marca/cuenta",
];

export function SettingsShell({
  active,
  children,
}: {
  active: SettingsSection;
  children: React.ReactNode;
}) {
  const entries = Object.entries(SETTINGS_SECTIONS) as [SettingsSection, (typeof SETTINGS_SECTIONS)[SettingsSection]][];
  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CONFIGURACIÓN</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">Configuración</h1>
      <div className="grid md:grid-cols-[200px_minmax(0,1fr)] gap-6 md:gap-10 items-start">
        {/* En el celular, una fila deslizable; en pantallas anchas, la
            lista a la izquierda. */}
        <nav
          aria-label="Secciones de configuración"
          className="flex md:flex-col gap-1 overflow-x-auto overflow-y-hidden md:overflow-visible -mx-1 px-1 pb-1 md:pb-0 md:sticky md:top-6"
        >
          {entries.map(([key, s]) => (
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
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-brand-ink mb-4">{SETTINGS_SECTIONS[active].label}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
