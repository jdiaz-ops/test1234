function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/// Cómo se ve una marca ante los creadores — se usa tal cual en el
/// marketplace real, y como vista previa dentro de Perfil del negocio, para
/// que la marca vea exactamente el mismo resultado en los dos lugares.
export function BrandMiniProfile({
  companyName,
  logoUrl,
  description,
  websiteUrl,
  websiteLinkable = true,
}: {
  companyName: string;
  logoUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  // false en vistas ilustrativas (ej. la landing de /para-creadores, con
  // marcas y dominios de ejemplo que no existen) — muestra el dominio
  // como texto plano en vez de un link cliqueable a ninguna parte.
  websiteLinkable?: boolean;
}) {
  const linkText = websiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  // Logo y nombre en una fila; la descripción y el link debajo, a todo el
  // ancho de la tarjeta — antes iban en una columna angosta al lado del
  // logo y en el marketplace se cortaban en dos palabras.
  return (
    <div>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={companyName}
            className="w-12 h-12 rounded-full object-cover shrink-0 border border-brand-line bg-white"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand-accent-soft text-brand-accent font-display font-semibold text-sm flex items-center justify-center shrink-0">
            {initials(companyName) || "?"}
          </div>
        )}
        <p className="min-w-0 font-display font-semibold text-brand-ink leading-snug">
          {companyName || "Nombre de tu marca"}
        </p>
      </div>
      {description && <p className="text-sm text-brand-ink-soft line-clamp-3 mt-3">{description}</p>}
      {websiteUrl && websiteLinkable && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-brand-accent hover:underline mt-2 inline-block truncate max-w-full"
        >
          {linkText}
        </a>
      )}
      {websiteUrl && !websiteLinkable && (
        <span className="text-xs text-brand-accent mt-2 inline-block truncate max-w-full">{linkText}</span>
      )}
    </div>
  );
}
