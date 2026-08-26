import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconHeart, IconStore, IconArrowRight } from "@/components/marketing/icons";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 relative overflow-hidden flex items-center justify-center px-6 py-24">
        {/* Antes un único blob centrado arriba — plano. Dos blobs
            asimétricos (uno grande arriba-izquierda, uno más chico
            abajo-derecha, distinta opacidad) le dan profundidad a la
            página sin salir de la paleta de marca (solo brand-accent). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 -left-40 h-[560px] w-[720px] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand-accent-soft), transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-56 -right-32 h-[500px] w-[640px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
        />

        <div className="relative max-w-4xl w-full text-center">
          {/* Versión simplificada: el logo grande (ya con la paleta de dos
              rosados) es lo único arriba — sin H1, sin ilustración aparte
              — y debajo, directo, las dos tarjetas. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
          <img src="/marcolini-logo-lockup.png" alt="Marcolini" className="h-40 sm:h-52 w-auto mx-auto mb-14" />

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {/* Tarjeta creador */}
            <Link
              href="/para-creadores"
              className="group rounded-3xl border border-brand-line bg-brand-surface p-8 text-left hover:border-brand-accent hover:shadow-[0_30px_70px_-32px_var(--brand-accent)] hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <IconHeart className="w-5 h-5" />
              </div>
              <span className="inline-block font-mono text-xs font-semibold tracking-widest text-brand-accent bg-brand-accent-soft rounded-full px-3 py-1 mb-3">
                SOY CREADOR
              </span>
              <p className="font-display text-2xl font-semibold text-brand-ink mb-2 text-balance">
                Convierte tu contenido e influencia en dinero
              </p>
              <p className="text-base text-brand-ink/75 leading-relaxed mb-6">
                Obtén códigos de descuento para tu comunidad y gana una comisión por cada compra
                que realicen con ellos.
              </p>
              <p className="text-sm text-brand-accent font-semibold inline-flex items-center gap-1.5">
                Quiero saber más
                <IconArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </p>
            </Link>

            {/* Tarjeta marca — logos de Shopify/WooCommerce arriba a la
                derecha (mismos assets y tratamiento de color que el hero de
                /para-marcas: brightness(0) para Shopify, grayscale para
                WooCommerce), como sello de "con qué se integra" en vez de
                una cifra de ejemplo. */}
            <Link
              href="/para-marcas"
              className="group rounded-3xl border border-brand-line bg-brand-surface p-8 text-left hover:border-brand-accent hover:shadow-[0_30px_70px_-32px_var(--brand-accent)] hover:-translate-y-1 transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center group-hover:scale-105 transition-transform">
                  <IconStore className="w-5 h-5" />
                </div>
                <div className="inline-flex items-center gap-2.5 bg-brand-bg border border-brand-line rounded-full px-3 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/, altura fija con filtro de color */}
                  <img src="/shopify.webp" alt="Shopify" className="h-3 w-auto" style={{ filter: "brightness(0)" }} />
                  <span aria-hidden className="h-3.5 w-px bg-brand-line" />
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/, altura fija con filtro de color */}
                  <img src="/Woocommerce.png" alt="WooCommerce" className="h-4 w-auto" style={{ filter: "grayscale(1)" }} />
                </div>
              </div>
              <span className="inline-block font-mono text-xs font-semibold tracking-widest text-brand-accent bg-brand-accent-soft rounded-full px-3 py-1 mb-3">
                SOY MARCA
              </span>
              <p className="font-display text-2xl font-semibold text-brand-ink mb-2 text-balance">
                Crece tu e‑commerce conectando tu marca con nuestra red de creadores de contenido
              </p>
              <p className="text-base text-brand-ink/75 leading-relaxed mb-6">
                Solo pagas comisión cuando generan ventas.
              </p>
              <p className="text-sm text-brand-accent font-semibold inline-flex items-center gap-1.5">
                Quiero saber más
                <IconArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </p>
            </Link>
          </div>

          <Link
            href="/login"
            className="text-sm text-brand-ink-soft hover:text-brand-accent hover:underline"
          >
            Ya tengo cuenta — Iniciar sesión
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
