import Image from "next/image";

/// Foto de la vitrina servida en el tamaño justo para cada pantalla y en
/// formato moderno (WebP), vía la optimización de imágenes de Next. Una
/// tarjeta de producto en celular baja así una foto de ~30 KB en vez de la
/// original de 2 MB. Ver conversación del 2026-10-01 ("fotos pesadas").
///
/// Solo se optimizan los orígenes declarados en next.config.ts (Vercel
/// Blob, donde suben las marcas, y el CDN de Shopify, de donde vienen las
/// importadas). Cualquier otro origen se muestra tal cual con <img>, en vez
/// de romper la página.
const OPTIMIZABLE_HOSTS = [/\.public\.blob\.vercel-storage\.com$/i, /^cdn\.shopify\.com$/i];

function canOptimize(src: string) {
  if (src.startsWith("/") && !src.startsWith("//") && !src.includes("?")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && OPTIMIZABLE_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

export function StoreImage({
  src,
  alt,
  className,
  sizes,
  priority,
  natural,
}: {
  src: string;
  alt: string;
  className?: string;
  /// Qué tan ancha se ve la foto en cada pantalla, para que el navegador
  /// elija el tamaño correcto (ej. "(min-width: 640px) 25vw, 50vw").
  sizes: string;
  /// La foto principal de la página (la primera que se ve): se carga ya.
  priority?: boolean;
  /// true = la foto manda su propio alto (ancho completo, sin recortar),
  /// como el banner en modo "original". false (por defecto) = llena el
  /// marco de su contenedor, que debe tener posición y tamaño.
  natural?: boolean;
}) {
  if (!canOptimize(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- origen no declarado: se muestra sin optimizar
      <img
        src={src}
        alt={alt}
        className={natural ? `w-full h-auto block ${className ?? ""}` : `absolute inset-0 w-full h-full ${className ?? ""}`}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }
  if (natural) {
    // El ancho y alto son solo la proporción de reserva mientras carga;
    // al cargar, la foto toma su proporción real (h-auto).
    return (
      <Image
        src={src}
        alt={alt}
        width={2000}
        height={1000}
        sizes={sizes}
        priority={priority}
        className={`w-full h-auto block ${className ?? ""}`}
      />
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />;
}
