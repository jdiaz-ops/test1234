"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Mensajes queda oculto por ahora (no se usa en esta fase) — el código y la
// ruta siguen intactos, solo se quitó del menú.
//
// Lista plana (sin encabezados de sección — quedaba confuso) — "Empieza
// aquí" va primero, arriba de Dashboard, y Campañas justo debajo de
// Dashboard porque es la acción que más queremos que el creador use.
// "Cuenta" es el único ítem con subsecciones, y solo se expande cuando hace
// falta — Transacciones vive ahí adentro, no en la lista principal.
const flatItems = [
  { href: "/creador/onboarding", label: "Empieza aquí" },
  { href: "/creador", label: "Dashboard" },
  { href: "/creador/retos", label: "Campañas" },
  { href: "/creador/marketplace", label: "Marketplace de marcas" },
  { href: "/creador/storefront", label: "Mi vitrina" },
  { href: "/creador/codigos", label: "Mis Códigos y Links" },
  { href: "/creador/referidos", label: "Invita y gana" },
];

const cuentaSubItems = [
  { href: "/creador/perfil", label: "Perfil" },
  { href: "/creador/pago", label: "Configuración de pago" },
  { href: "/creador/transacciones", label: "Transacciones" },
  { href: "/creador/cuenta", label: "Seguridad" },
];

const trailingItems = [
  { href: "/creador/notificaciones", label: "Notificaciones" },
];

function isActive(pathname: string, href: string) {
  return href === "/creador" ? pathname === href : pathname.startsWith(href);
}

export function PortalNav({
  onboardingRemaining = 0,
}: {
  onboardingRemaining?: number;
}) {
  const pathname = usePathname();
  // "Empieza aquí" solo se ve mientras falte algo — antes quedaba en el
  // menú para siempre, aunque el creador ya hubiera terminado los 4
  // pasos (mismo criterio que ya usa BrandNav para el equivalente de
  // marca: el link desaparece solo con onboarding.complete).
  const items =
    onboardingRemaining > 0
      ? flatItems
      : flatItems.filter((item) => item.href !== "/creador/onboarding");
  const cuentaHasActiveChild = cuentaSubItems.some((i) =>
    isActive(pathname, i.href),
  );
  const [cuentaOpen, setCuentaOpen] = useState(cuentaHasActiveChild);
  const cuentaExpanded = cuentaOpen || cuentaHasActiveChild;

  function renderLink(item: { href: string; label: string }, badge = 0) {
    const active = isActive(pathname, item.href);
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
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) =>
        renderLink(
          item,
          item.href === "/creador/onboarding" ? onboardingRemaining : 0,
        ),
      )}

      <button
        type="button"
        onClick={() => setCuentaOpen((v) => !v)}
        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
          cuentaHasActiveChild
            ? "text-brand-accent font-medium"
            : "text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink"
        }`}
      >
        Cuenta
        <span
          className={`text-xs transition-transform ${cuentaExpanded ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {cuentaExpanded && (
        <div className="flex flex-col gap-0.5 pl-3 border-l border-brand-line ml-3">
          {cuentaSubItems.map((item) => renderLink(item))}
        </div>
      )}

      {trailingItems.map((item) => renderLink(item))}
    </nav>
  );
}
