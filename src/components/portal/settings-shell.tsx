import { SectionTabs } from "@/components/portal/section-tabs";

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

/// Fuera del menú (la página sigue abierta por su link): "Conexiones"
/// (webhooks) se escondió a pedido de la marca el 2026-10-19.
const HIDDEN_SECTIONS = new Set<SettingsSection>(["conexiones"]);

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
  const entries = (Object.entries(SETTINGS_SECTIONS) as [SettingsSection, (typeof SETTINGS_SECTIONS)[SettingsSection]][]).filter(
    ([key]) => !HIDDEN_SECTIONS.has(key) || key === active,
  );
  // Pestañas arriba, como en Tienda (2026-10-20; antes una lista a la
  // izquierda en pantallas anchas).
  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CONFIGURACIÓN</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">Configuración</h1>
      <SectionTabs label="Secciones de configuración" tabs={entries.map(([key, s]) => ({ key, ...s }))} active={active} />
      {children}
    </div>
  );
}
