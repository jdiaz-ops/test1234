"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mensajes queda oculto por ahora (no se usa en esta fase) — el código y la
// ruta siguen intactos, solo se quitó del menú.
//
// Agrupado por tema (ver conversación con Juan) — Dashboard y "Empieza aquí"
// quedan sueltos arriba de todo, el resto va en grupos con encabezado.
const groups: { label: string | null; items: { href: string; label: string }[] }[] = [
  {
    label: null,
    items: [
      { href: "/creador", label: "Dashboard" },
      { href: "/creador/onboarding", label: "Empieza aquí" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/creador/marketplace", label: "Marketplace" },
      { href: "/creador/retos", label: "Retos" },
    ],
  },
  {
    label: "Mi vitrina",
    items: [
      { href: "/creador/storefront", label: "Mi Storefront" },
      { href: "/creador/codigos", label: "Mis Códigos y Links" },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { href: "/creador/transacciones", label: "Transacciones" },
      { href: "/creador/perfil", label: "Perfil" },
      { href: "/creador/pago", label: "Configuración de pago" },
      { href: "/creador/notificaciones", label: "Notificaciones" },
      { href: "/creador/cuenta", label: "Cuenta" },
    ],
  },
  {
    label: "Aprende",
    items: [{ href: "/creador/aprende", label: "Marketing de afiliados" }],
  },
];

export function PortalNav({ onboardingRemaining = 0 }: { onboardingRemaining?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group, i) => (
        <div key={group.label ?? `top-${i}`} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="px-3 pt-1 pb-0.5 font-mono text-[10px] font-medium text-brand-ink-soft/70 tracking-widest uppercase">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const exact = item.href === "/creador";
            const active = exact ? pathname === item.href : pathname.startsWith(item.href);
            const badge = item.href === "/creador/onboarding" ? onboardingRemaining : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  active
                    ? "bg-brand-accent-soft text-brand-accent font-medium"
                    : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
                }`}
              >
                {item.label}
                {badge > 0 && (
                  <span className="bg-brand-accent text-white text-[10px] font-mono font-medium rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
