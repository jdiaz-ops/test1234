/// Badge discreto al pie de toda la vitrina — visible siempre (subdominio
/// gratis, dominio propio o el link viejo /t/{slug}), pero pensado sobre
/// todo para cuando la marca usa su propio dominio: ahí "marcolini" ya no
/// aparece en ningún lado de la URL, así que esto es lo único que deja
/// claro con qué está construida la tienda — inspirado en el "Powered by
/// Shopify" de siempre, pero discreto (texto chico, bajo contraste).
export function PoweredByBadge() {
  return (
    <div className="text-center py-6">
      <a
        href="https://marcolini.lat"
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] text-brand-ink-soft/70 hover:text-brand-accent"
      >
        Creado con Marcolini
      </a>
    </div>
  );
}
