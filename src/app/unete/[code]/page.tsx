import type { Metadata } from "next";
import Link from "next/link";
import { getActiveAllyByCode } from "@/server/services/ally-service";
import { AllyJoinForm } from "@/components/aliados/ally-join-form";

/// La página del link de un aliado comercial (marcolini.lat/unete/{code}):
/// la marca o la creadora elige qué es y deja sus datos; Marcolini la revisa
/// y la contacta (ver ally-service.ts). La marca y la creadora no ven nada
/// del aliado más que su nombre en la invitación.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Únete a Marcolini",
  description: "Marcas de uñas y creadoras de contenido: deja tus datos y el equipo de Marcolini te contacta.",
  robots: { index: false },
};

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ally = await getActiveAllyByCode(code);
  return (
    <div className="min-h-screen bg-brand-bg px-4 py-10 sm:py-16">
      <div className="max-w-lg mx-auto space-y-6">
        <Link href="/" className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
          <img src="/marcolini-logo-lockup.png" alt="Marcolini" className="h-9 w-auto" />
        </Link>
        {ally ? (
          <>
            <div className="text-center space-y-2">
              <p className="font-mono text-xs tracking-widest text-brand-accent">{ally.name.toUpperCase()} TE INVITA</p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-balance">Vende con Marcolini</h1>
              <p className="text-sm text-brand-ink-soft text-balance">
                Conectamos marcas de uñas con una red seleccionada de creadoras de contenido. Dinos quién eres y el equipo te contacta.
              </p>
            </div>
            <AllyJoinForm code={code} />
          </>
        ) : (
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-center space-y-2">
            <h1 className="font-display text-xl font-semibold text-brand-ink">Este link no está activo</h1>
            <p className="text-sm text-brand-ink-soft">
              Pídele a quien te lo mandó un link nuevo, o conoce Marcolini en{" "}
              <Link href="/para-marcas" className="text-brand-accent hover:underline">
                para marcas
              </Link>{" "}
              y{" "}
              <Link href="/para-creadores" className="text-brand-accent hover:underline">
                para creadoras
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
