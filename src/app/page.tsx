import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-2xl w-full text-center">
          <p className="font-mono text-sm text-brand-accent tracking-widest mb-6">
            MARCOLINI
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand-ink mb-5 text-balance leading-tight">
            La red de afiliación de la industria de belleza
          </h1>
          <p className="text-brand-ink-soft text-lg max-w-lg mx-auto mb-12">
            Conecta marcas y creadores en un solo lugar — comisión real, sin
            costo fijo, un pago automático cada mes.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <Link
              href="/para-creadores"
              className="group rounded-2xl border border-brand-line bg-brand-surface p-6 text-left hover:border-brand-accent transition-colors"
            >
              <p className="font-mono text-xs text-brand-ink-soft tracking-wide mb-2">
                SOY CREADOR
              </p>
              <p className="font-display font-semibold text-brand-ink mb-1">
                Monetiza tu contenido
              </p>
              <p className="text-sm text-brand-ink-soft">
                Un código, todas las marcas →
              </p>
            </Link>

            <Link
              href="/para-marcas"
              className="group rounded-2xl border border-brand-line bg-brand-surface p-6 text-left hover:border-brand-accent transition-colors"
            >
              <p className="font-mono text-xs text-brand-ink-soft tracking-wide mb-2">
                SOY MARCA
              </p>
              <p className="font-display font-semibold text-brand-ink mb-1">
                Crea tu programa de afiliados
              </p>
              <p className="text-sm text-brand-ink-soft">
                Pagas solo si hay venta →
              </p>
            </Link>
          </div>

          <Link
            href="/login"
            className="text-sm text-brand-ink-soft hover:text-brand-accent hover:underline"
          >
            Ya tengo cuenta — iniciar sesión
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
