import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import {
  IconWallet,
  IconSliders,
  IconTarget,
  IconTrace,
  IconArrowRight,
} from "@/components/marketing/icons";

const beneficios = [
  {
    icon: IconWallet,
    titulo: "Sin mensualidad fija",
    texto: "No pagas nada por usar Marcolini si no vendes. Cero cuota, cero riesgo.",
  },
  {
    icon: IconSliders,
    titulo: "Tú tienes el control",
    texto: "Eliges la comisión, el descuento, y si cada creador necesita tu aprobación.",
  },
  {
    icon: IconTarget,
    titulo: "Marketplace exclusivo",
    texto: "No aceptamos a cualquier marca — cada solicitud pasa por aprobación.",
  },
  {
    icon: IconTrace,
    titulo: "Trazabilidad total",
    texto: "Sabes exactamente qué creador de contenido generó cada venta.",
  },
];

const pasos = [
  {
    paso: "1",
    titulo: "Tú creas el descuento",
    texto: "Defines qué % de descuento recibe, en tu página web, quien compre con el código de un creador de contenido.",
  },
  {
    paso: "2",
    titulo: "Un creador de contenido lo promueve",
    texto: "Comparte tu marca con su audiencia usando su código único.",
  },
  {
    paso: "3",
    titulo: "Rastreamos la venta",
    texto: "Cuando alguien compra en tu web con ese código, sabemos que fue gracias a ese creador de contenido.",
  },
  {
    paso: "4",
    titulo: "Se paga la comisión",
    texto: "El creador de contenido recibe automáticamente el % que tú elegiste — el resto es tu venta.",
  },
];

export default async function ComoFuncionaPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const summary = await getBrandDashboardSummary(profile.id);

  return (
    <div className="-mx-8 -my-10">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand-accent-soft), transparent)" }}
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <span className="inline-block font-mono text-xs font-medium text-brand-accent tracking-widest bg-brand-accent-soft rounded-full px-4 py-1.5 mb-7">
            PROGRAMA DE AFILIADOS
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand-ink mb-6 text-balance leading-[1.1]">
            Vende más sin arriesgar un peso por adelantado
          </h1>
          <p className="text-brand-ink-soft text-lg max-w-xl mx-auto text-balance">
            Marcolini conecta a {profile.companyName} con creadores de contenido que promueven tus
            productos.{" "}
            <span className="text-brand-ink font-medium">
              Sin mensualidades — solo pagas cuando hay una venta real.
            </span>
          </p>
        </div>
      </section>

      {/* Beneficios */}
      <section className="max-w-5xl mx-auto px-6 py-14 border-t border-brand-line">
        <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">
          ¿POR QUÉ FUNCIONA ASÍ?
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-12 text-balance">
          Un canal de ventas que se paga solo con resultados
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {beneficios.map((b) => (
            <div
              key={b.titulo}
              className="group rounded-2xl bg-brand-surface border border-brand-line p-6 hover:border-brand-accent hover:shadow-[0_16px_40px_-24px_var(--brand-accent)] transition"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <b.icon className="w-5 h-5" />
              </div>
              <p className="font-display font-semibold text-brand-ink mb-1.5">{b.titulo}</p>
              <p className="text-sm text-brand-ink-soft leading-relaxed">{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-5xl mx-auto px-6 py-14 border-t border-brand-line">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-14">
          ¿Cómo funciona, paso a paso?
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 relative">
          <div
            aria-hidden
            className="hidden lg:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-brand-line"
          />
          {pasos.map((p) => (
            <div key={p.paso} className="relative text-center">
              <div className="relative z-10 w-12 h-12 mx-auto rounded-full bg-brand-accent text-white font-mono text-sm font-semibold flex items-center justify-center mb-5">
                {p.paso}
              </div>
              <p className="font-display font-semibold text-brand-ink mb-2">{p.titulo}</p>
              <p className="text-sm text-brand-ink-soft leading-relaxed max-w-[220px] mx-auto">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tarifa transparente */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-brand-ink text-white px-8 py-16 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
          />
          <p className="relative font-mono text-sm text-brand-accent mb-3 tracking-wide">
            {summary.platformFeePercent}% + IVA
          </p>
          <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-4 text-balance">
            Una sola tarifa, sin costos ocultos
          </h2>
          <p className="relative text-white/70 max-w-xl mx-auto mb-9 text-balance">
            Pagas la comisión que definiste para tus creadores, más una tarifa de plataforma del{" "}
            {summary.platformFeePercent}% + IVA ({summary.vatPercent}%) — nunca se descuenta de lo que
            gana el creador de contenido. Sin ventas, no hay cobro.
          </p>
          <Link
            href="/marca/ofertas"
            className="relative inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition"
          >
            Ir a Oferta y comisión
            <IconArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
