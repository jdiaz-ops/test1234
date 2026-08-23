import { auth } from "@/auth";
import { getCreatorProfileByUserId } from "@/server/services/creator-profile-service";
import {
  IconSparkle,
  IconHeart,
  IconUsers,
  IconTrendingUp,
  IconArrowRight,
} from "@/components/marketing/icons";

const beneficios = [
  {
    icon: IconSparkle,
    titulo: "Sin publicidad forzada",
    texto: "Integras tu código a tu contenido de siempre — no tienes que convertirte en vendedor.",
  },
  {
    icon: IconHeart,
    titulo: "Autenticidad ante todo",
    texto: "Solo recomiendas marcas que tú elegiste unirte — tu audiencia lo nota y confía más.",
  },
  {
    icon: IconUsers,
    titulo: "Tu audiencia también gana",
    texto: "Le das un descuento real con tu código — no es solo una comisión para ti.",
  },
  {
    icon: IconTrendingUp,
    titulo: "Ingreso extra, todos los meses",
    texto: "Cada venta con tu código te paga una comisión automática, sin que hagas nada más.",
  },
];

const pasos = [
  {
    paso: "1",
    titulo: "Eliges tus marcas",
    texto: "Del marketplace — las que ya usas, te gustan, o le sirven a tu audiencia.",
  },
  {
    paso: "2",
    titulo: "Obtienes tu código único",
    texto: "Tú lo eliges al unirte a cada marca — así te reconocen tus seguidores.",
  },
  {
    paso: "3",
    titulo: "Lo compartes con tu audiencia",
    texto: "En tu bio, tus historias, o donde ya hablas con ellos todos los días.",
  },
  {
    paso: "4",
    titulo: "Ganas comisión automática",
    texto: "Cada venta con tu código se rastrea sola y se paga sin que tengas que reclamar nada.",
  },
];

const buenasPracticas = [
  "Intégralo a tu contenido — cuenta por qué usas esa marca, no solo pegues el código.",
  "Sé transparente: di que es tu código de descuento. Genera más confianza, no menos.",
  "Ponlo en un lugar fácil de encontrar — bio, pin en comentarios, o en la descripción.",
  "Actualiza tu vitrina cuando te unas a una marca nueva, para que esté todo en un solo link.",
];

const evitar = [
  "Pegar el código sin contexto, publicación tras publicación.",
  "Prometer resultados o descuentos que la marca no ofrece.",
  "Esconder que es un código de afiliado — tu audiencia lo va a notar igual.",
  "Dejar tu vitrina desactualizada con marcas de las que ya no eres parte.",
];

const avisoLegal = [
  'Marca claramente que es contenido publicitario o con código de afiliado — con palabras como "Publicidad" o "Pauta", no solo un hashtag perdido al final.',
  "Ponlo en un lugar visible desde el principio — al inicio del video o del post, no escondido donde nadie lo vea.",
  "Aplica igual en historias, reels y contenido en vivo, no solo en publicaciones fijas.",
  "Comunica solo lo que la marca realmente respalda — no prometas efectos, resultados o garantías por tu cuenta.",
];

export default async function AprendePage() {
  const session = await auth();
  const profile = await getCreatorProfileByUserId(session!.user.id);

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
            MARKETING DE AFILIADOS
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand-ink mb-6 text-balance leading-[1.1]">
            Convierte tu contenido en ingresos
          </h1>
          <p className="text-brand-ink-soft text-lg max-w-xl mx-auto text-balance">
            {profile.displayName}, Marcolini te conecta con marcas que quieren que tu comunidad compre
            gracias a ti.{" "}
            <span className="text-brand-ink font-medium">
              Sin inversión de tu parte — ganas cuando alguien compra con tu código.
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
          Recomendar bien también es contenido
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

      {/* Cómo comunicarlo bien — el corazón de esta sección */}
      <section className="max-w-5xl mx-auto px-6 py-14 border-t border-brand-line">
        <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">
          LO MÁS IMPORTANTE
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-12 text-balance">
          Cómo comunicarlo bien
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-brand-surface border border-brand-line p-6">
            <p className="font-display font-semibold text-brand-ink mb-4">Hazlo así</p>
            <ul className="space-y-3">
              {buenasPracticas.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-brand-ink-soft leading-relaxed">
                  <span className="text-brand-accent font-semibold shrink-0">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-brand-surface border border-brand-line p-6">
            <p className="font-display font-semibold text-brand-ink mb-4">Evita esto</p>
            <ul className="space-y-3">
              {evitar.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-brand-ink-soft leading-relaxed">
                  <span className="text-brand-ink-soft font-semibold shrink-0">✕</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Aviso legal — transparencia publicitaria */}
      <section className="max-w-5xl mx-auto px-6 py-14 border-t border-brand-line">
        <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">AVISO LEGAL</p>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-4 text-balance">
          Transparencia en tus publicaciones
        </h2>
        <p className="text-sm text-brand-ink-soft text-center max-w-2xl mx-auto mb-10">
          En Colombia, la Superintendencia de Industria y Comercio (SIC) exige que la publicidad de
          influenciadores sea identificable como tal — tu audiencia tiene derecho a saber cuándo estás
          promocionando algo a cambio de una comisión.
        </p>
        <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 max-w-2xl mx-auto">
          <ul className="space-y-3">
            {avisoLegal.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-brand-ink-soft leading-relaxed">
                <span className="text-brand-accent font-semibold shrink-0">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-ink-soft text-center max-w-2xl mx-auto mt-6">
          Esta es una guía general, no asesoría legal — si tienes dudas específicas sobre tu caso, consulta
          a un abogado.
        </p>
      </section>

      {/* CTA de cierre */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-brand-ink text-white px-8 py-16 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
          />
          <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-4 text-balance">
            Tu vitrina es tu punto de partida
          </h2>
          <p className="relative text-white/70 max-w-xl mx-auto mb-9 text-balance">
            Únete a marcas, arma tu vitrina con tu link personalizado, y empieza a compartirlo donde ya
            hablas con tu audiencia.
          </p>
          <a
            href="/creador/marketplace"
            className="relative inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition"
          >
            Explorar el marketplace
            <IconArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
