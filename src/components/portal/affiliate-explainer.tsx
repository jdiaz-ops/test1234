const steps = [
  {
    title: "Tú creas el descuento",
    text: "Defines qué % de descuento recibe, en tu página web, quien compre con el código de un creador de contenido.",
  },
  {
    title: "Un creador de contenido lo promueve",
    text: "Comparte tu marca con su audiencia usando su código único.",
  },
  {
    title: "Rastreamos la venta",
    text: "Cuando alguien compra en tu web con ese código, sabemos que fue gracias a ese creador de contenido.",
  },
  {
    title: "Se paga la comisión",
    text: "El creador de contenido recibe automáticamente el % que tú elegiste — el resto es tu venta.",
  },
];

/// Explicador simple del mecanismo de afiliación — vive en Oferta y
/// comisión (no en el onboarding, que ya está explicando paso a paso) para
/// que la marca lo pueda consultar cuando quiera, no solo una vez.
export function AffiliateExplainer() {
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <div className="rounded-xl bg-brand-accent text-white px-4 py-3 mb-4">
        <p className="font-display font-semibold leading-snug">Sin mensualidad fija</p>
        <p className="text-xs opacity-90 mt-0.5">
          No pagas nada por usar Marcolini si no vendes — nuestra tarifa se cobra únicamente sobre
          ventas reales. Pagas solo cuando hay resultados.
        </p>
      </div>
      <p className="font-display font-semibold text-brand-ink mb-1">¿Cómo funciona la afiliación?</p>
      <p className="text-xs text-brand-ink-soft mb-4">
        Un creador de contenido promueve tu marca y gana una comisión por cada venta que genera.
      </p>
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={step.title} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-6 h-6 rounded-full bg-brand-accent-soft text-brand-accent font-mono text-xs font-medium flex items-center justify-center">
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className="w-px flex-1 bg-brand-line mt-1" />}
            </div>
            <div className="pb-1">
              <p className="text-sm font-medium text-brand-ink">{step.title}</p>
              <p className="text-xs text-brand-ink-soft mt-0.5">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
