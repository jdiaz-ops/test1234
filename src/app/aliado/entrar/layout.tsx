import Link from "next/link";

/// La entrada al portal de aliados: misma tarjeta que el login.
export default function AllyLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12">
      <div className="w-full max-w-sm bg-brand-surface rounded-xl shadow-sm border border-brand-line p-8">
        <Link href="/" className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
          <img src="/marcolini-icon.png" alt="Marcolini" className="h-8 w-auto" />
        </Link>
        {children}
      </div>
    </div>
  );
}
