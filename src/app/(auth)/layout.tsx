// Layout provisional para las páginas de autenticación — estilo mínimo,
// funcional. La identidad visual definitiva (colores, tipografía, logo) se
// aplica en la tarea de Identidad Visual, sin tener que tocar la estructura.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <p className="text-center text-sm font-medium text-gray-400 mb-6 tracking-wide">
          MARCOLINI
        </p>
        {children}
      </div>
    </div>
  );
}
