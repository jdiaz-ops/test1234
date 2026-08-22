// Layout compartido de las páginas de autenticación, ya con la identidad
// visual definitiva de Marcolini (dirección "Sistema Confiable", en nude/rosado).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-12">
      <div className="w-full max-w-sm bg-brand-surface rounded-xl shadow-sm border border-brand-line p-8">
        <p className="text-center text-sm font-medium text-brand-accent mb-6 tracking-wide font-mono">
          MARCOLINI
        </p>
        {children}
      </div>
    </div>
  );
}
