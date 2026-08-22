import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-brand-line bg-brand-surface/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm font-medium text-brand-accent tracking-wide">
          MARCOLINI
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/para-creadores" className="text-brand-ink-soft hover:text-brand-ink">
            Para Creadores
          </Link>
          <Link href="/para-marcas" className="text-brand-ink-soft hover:text-brand-ink">
            Para Marcas
          </Link>
          <Link
            href="/login"
            className="text-brand-ink font-medium border border-brand-line rounded-full px-4 py-1.5 hover:bg-brand-accent-soft"
          >
            Ya tengo cuenta
          </Link>
        </nav>
      </div>
    </header>
  );
}
