import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-line mt-24">
      <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-ink-soft">
        <p className="font-mono text-brand-ink-soft">MARCOLINI</p>
        <div className="flex gap-6">
          <Link href="/para-creadores" className="hover:text-brand-ink">
            Para Creadores
          </Link>
          <Link href="/para-marcas" className="hover:text-brand-ink">
            Para Marcas
          </Link>
          <Link href="/terminos" className="hover:text-brand-ink">
            Términos
          </Link>
        </div>
      </div>
    </footer>
  );
}
