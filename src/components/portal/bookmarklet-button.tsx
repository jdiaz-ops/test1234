/// Botón "arrastra a tus marcadores" — corre en CUALQUIER página que el
/// creador visite (no solo dentro de Marcolini). Al hacer clic, mira en qué
/// dominio está, le pregunta a /api/bm/{creatorId} si esa marca está en
/// Marcolini y si el creador tiene código activo con ella, y si sí, le
/// muestra el link listo (con el código ya aplicado en Shopify) para que lo
/// copie — sin tener que venir hasta acá a buscar su código a mano. No es
/// una extensión de navegador — es un bookmarklet (un link normal que en
/// vez de navegar corre JS), así que no hay nada que instalar desde una
/// tienda de extensiones.
///
/// El <a href="javascript:..."> se arma con dangerouslySetInnerHTML a
/// propósito — desde React 19, poner un href que empiece con "javascript:"
/// directo en el prop `href` lo bloquea como medida de seguridad (piensa
/// que es una inyección), y esta es la única forma real de saltar eso para
/// un bookmarklet legítimo. El contenido es 100% generado acá (nunca texto
/// que haya escrito un usuario), así que no hay riesgo de inyección real.
function escapeHtmlAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

export function BookmarkletButton({
  creatorId,
  appOrigin,
}: {
  creatorId: string;
  appOrigin: string;
}) {
  const code = `(function(){var h=location.hostname,p=location.pathname;fetch("${appOrigin}/api/bm/${creatorId}?host="+encodeURIComponent(h)+"&path="+encodeURIComponent(p)).then(function(r){return r.json()}).then(function(d){if(d&&d.link){window.prompt("Tu código con "+(d.brand||"esta marca")+": "+d.code+" — copia tu link:",d.link);}else{alert("Esta marca no está en Marcolini, o no tienes un código activo con ella.");}}).catch(function(){alert("No se pudo conectar con Marcolini — intenta de nuevo.");});})();`;

  const anchorHtml = `<a href='javascript:${escapeHtmlAttr(code)}' class="inline-block cursor-grab active:cursor-grabbing bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-semibold select-none" title="Arrástrame a tu barra de marcadores">+ Código Marcolini</a>`;

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <p className="text-sm font-medium text-brand-ink mb-1">
        Tu botón para cualquier tienda
      </p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Arrastra este botón a la barra de marcadores de tu navegador. Cuando
        estés navegando en la tienda de una marca vinculada a ti, dale clic —
        te muestra tu link con el código ya listo para copiar, sin tener que
        venir hasta acá a buscarlo.
      </p>
      <div dangerouslySetInnerHTML={{ __html: anchorHtml }} />
      <p className="text-[11px] text-brand-ink-soft mt-2">
        ¿No ves la barra de marcadores? En Chrome/Edge: Ctrl+Shift+B (⌘+Shift+B
        en Mac). Si le das clic en vez de arrastrarlo acá en Marcolini, no
        pasa nada malo — solo no va a encontrar ninguna marca porque no
        estás en la tienda de una todavía.
      </p>
    </div>
  );
}
