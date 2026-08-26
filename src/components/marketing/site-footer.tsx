import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-line mt-24">
      <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-ink-soft">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
        <img src="/marcolini-icon.png" alt="Marcolini" className="h-7 w-auto" />
        <div className="flex gap-6">
          <Link href="/para-creadores" className="hover:text-brand-ink">
            Soy Creador
          </Link>
          <Link href="/para-marcas" className="hover:text-brand-ink">
            Soy Marca
          </Link>
          <Link href="/terminos" className="hover:text-brand-ink">
            Términos
          </Link>
          <Link href="/privacidad" className="hover:text-brand-ink">
            Privacidad
          </Link>
        </div>
      </div>
    </footer>
  );
}
