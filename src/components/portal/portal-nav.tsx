"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mensajes queda oculto por ahora (no se usa en esta fase) — el código y la
// ruta siguen intactos, solo se quitó del menú.
const items = [
  { href: "/creador", label: "Dashboard", exact: true },
  { href: "/creador/onboarding", label: "Empieza aquí" },
  { href: "/creador/marketplace", label: "Marketplace" },
  { href: "/creador/retos", label: "Retos" },
  { href: "/creador/storefront", label: "Mi Storefront" },
  { href: "/creador/codigos", label: "Mis Códigos y Links" },
  { href: "/creador/transacciones", label: "Transacciones" },
  { href: "/creador/perfil", label: "Perfil" },
  { href: "/creador/pago", label: "Configuración de pago" },
  { href: "/creador/notificaciones", label: "Notificaciones" },
  { href: "/creador/cuenta", label: "Cuenta" },
];

export function PortalNav({ onboardingRemaining = 0 }: { onboardingRemaining?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
    </nav>
  );
}
