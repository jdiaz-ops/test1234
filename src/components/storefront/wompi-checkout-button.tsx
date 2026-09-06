"use client";

import { useEffect, useRef } from "react";

export type WompiWidgetParams = {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
  redirectUrl: string;
};

/// El widget de Wompi se monta insertando su script oficial con atributos
/// `data-*` (incluye `data-signature:integrity`, con dos puntos — por eso
/// se arma con el DOM directo y no con JSX, que no acepta ese nombre de
/// atributo). El script, una vez cargado, reemplaza su propio <script> por
/// el botón real de pago — ver
/// https://docs.wompi.co/en/docs/colombia/widget-checkout-web/
export function WompiCheckoutButton({ params }: { params: WompiWidgetParams }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const form = document.createElement("form");
    const script = document.createElement("script");
    script.src = "https://checkout.wompi.co/widget.js";
    script.setAttribute("data-render", "button");
    script.setAttribute("data-public-key", params.publicKey);
    script.setAttribute("data-currency", params.currency);
    script.setAttribute("data-amount-in-cents", String(params.amountInCents));
    script.setAttribute("data-reference", params.reference);
    script.setAttribute("data-signature:integrity", params.signature);
    script.setAttribute("data-redirect-url", params.redirectUrl);
    form.appendChild(script);
    container.appendChild(form);
  }, [params]);

  return <div ref={containerRef} />;
}
