import Link from "@/components/storefront/store-link";
import type { SiblingGroup } from "@/server/services/product-sibling-service";

/// "Tono: FACILITA · ¿Buscas otro tono de Salmón y Naranjas?" — los demás
/// productos del mismo grupo como cuadritos con su foto, dentro de la
/// página del producto (como las variaciones de Amazon), para saltar
/// entre tonos sin volver a la colección. Ver conversación del 2026-10-18.
/// "otro tono", "otra talla": el artículo según el eje.
const FEMININE_AXES = new Set(["cantidad", "talla", "opción", "opcion", "referencia", "presentación", "presentacion", "fragancia", "medida"]);

export function SiblingProducts({ siblings, basePath }: { siblings: SiblingGroup; basePath: string }) {
  const axis = siblings.axis || "Opción";
  const feminine = FEMININE_AXES.has(axis.toLowerCase());
  return (
    <div className="space-y-2">
      <p className="text-sm text-brand-ink">
        {axis}: <span className="font-semibold">{siblings.current}</span>
      </p>
      <p className="text-xs text-brand-ink-soft">
        ¿Buscas {feminine ? "otra" : "otro"} {axis.toLowerCase()} de {siblings.group}? Estas son las demás opciones:
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="list" aria-label={`Otras opciones de ${siblings.group} (${axis.toLowerCase()})`}>
        {siblings.items.map((item) => {
          const box = item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto del producto hermano
            <img src={item.imageUrl} alt={item.value} className="h-16 w-16 object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center px-1 text-center text-[10px] leading-tight text-brand-ink">
              {item.value}
            </span>
          );
          const frame = `block overflow-hidden rounded-md border-2 bg-brand-accent-soft ${
            item.current ? "border-brand-ink" : "border-brand-line hover:border-brand-ink"
          } ${item.soldOut ? "opacity-50" : ""}`;
          return (
            <div key={item.id} role="listitem" className="w-16 shrink-0">
              {item.current ? (
                <span className={frame} aria-current="true" title={item.value}>
                  {box}
                </span>
              ) : (
                <Link href={`${basePath}/${item.slug}`} className={frame} title={item.soldOut ? `${item.value} — agotado` : item.value}>
                  {box}
                </Link>
              )}
              <span className={`mt-1 block truncate text-center text-[10px] ${item.current ? "font-semibold text-brand-ink" : "text-brand-ink-soft"}`}>
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
