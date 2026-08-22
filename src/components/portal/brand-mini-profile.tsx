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
}: {
  companyName: string;
  logoUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={companyName}
          className="w-11 h-11 rounded-full object-cover shrink-0 border border-brand-line"
        />
      ) : (
        <div className="w-11 h-11 rounded-full bg-brand-accent-soft text-brand-accent font-display font-semibold text-sm flex items-center justify-center shrink-0">
          {initials(companyName) || "?"}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-display font-semibold text-brand-ink truncate">{companyName || "Nombre de tu marca"}</p>
        {description && <p className="text-xs text-brand-ink-soft line-clamp-2 mt-0.5">{description}</p>}
        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-accent hover:underline mt-0.5 inline-block truncate max-w-full"
          >
            {websiteUrl.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
    </div>
  );
}
