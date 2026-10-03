import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { UtmCapture } from "@/components/marketing/utm-capture";
import { IconHeart, IconStore, IconArrowRight } from "@/components/marketing/icons";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <UtmCapture />
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
              — y debajo, directo, las dos tarjetas. El slogan va chico y
              elegante entre el logo y las tarjetas, como acompañante, no
              como titular. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
          <img src="/marcolini-logo-lockup.png" alt="Marcolini" className="h-40 sm:h-52 w-auto mx-auto mb-8" />

          {/* Tagline (aprobado el 2026-10-03). */}
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink text-balance max-w-2xl mx-auto mb-3">
            Somos la plataforma que conecta marcas de uñas con una red seleccionada de creadoras de
            contenido e instructoras.
          </h1>
          <p className="text-base text-brand-ink-soft text-balance max-w-xl mx-auto mb-12">
            Las marcas solo pagan cuando venden.
          </p>

          {/* Las dos tarjetas comparten filas (subgrid): ícono, etiqueta,
              título, texto y "Quiero saber más" quedan a la misma altura en
              ambas aunque una tenga más texto (2026-10-03). */}
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {/* Tarjeta creador */}
            <Link
              href="/para-creadores"
              className="group grid grid-rows-subgrid row-span-5 gap-y-0 rounded-3xl border border-brand-line bg-brand-surface p-8 text-left hover:border-brand-accent hover:shadow-[0_30px_70px_-32px_var(--brand-accent)] hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <IconHeart className="w-5 h-5" />
              </div>
              <span className="justify-self-start self-start max-w-full font-mono text-[11px] leading-snug font-semibold tracking-wider text-brand-accent bg-brand-accent-soft rounded-lg px-3 py-1.5 mb-3 text-balance">
                SOY CREADORA DE CONTENIDO DE UÑAS O INSTRUCTORA
              </span>
              <p className="font-display text-2xl font-semibold text-brand-ink mb-2 text-balance">
                Convierte tu contenido e influencia en dinero
              </p>
              <p className="text-base text-brand-ink/75 leading-relaxed mb-6">
                Recomienda los productos de uñas con los que trabajas y gana comisión por cada compra
                que tu comunidad haga con tu código.
              </p>
              <p className="self-end justify-self-start text-sm text-brand-accent font-semibold inline-flex items-center gap-1.5">
                Quiero saber más
                <IconArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </p>
            </Link>

            {/* Tarjeta marca — sin logos de Shopify/WooCommerce: la marca ya
                no depende de conectar un e-commerce externo, tiene su
                propia tienda nativa dentro de Marcolini ("Mi tienda"). */}
            <Link
              href="/para-marcas"
              className="group grid grid-rows-subgrid row-span-5 gap-y-0 rounded-3xl border border-brand-line bg-brand-surface p-8 text-left hover:border-brand-accent hover:shadow-[0_30px_70px_-32px_var(--brand-accent)] hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <IconStore className="w-5 h-5" />
              </div>
              <span className="justify-self-start self-start max-w-full font-mono text-[11px] leading-snug font-semibold tracking-wider text-brand-accent bg-brand-accent-soft rounded-lg px-3 py-1.5 mb-3 text-balance">
                SOY MARCA DE UÑAS
              </span>
              <p className="font-display text-2xl font-semibold text-brand-ink mb-2 text-balance">
                Conectamos tu marca de uñas con una red seleccionada de creadoras de contenido e
                instructoras.
              </p>
              <p className="text-base text-brand-ink/75 leading-relaxed mb-6">
                Ellas recomiendan tus productos a miles de manicuristas. Tú solo pagas comisión cuando
                generan ventas.
              </p>
              <p className="self-end justify-self-start text-sm text-brand-accent font-semibold inline-flex items-center gap-1.5">
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
