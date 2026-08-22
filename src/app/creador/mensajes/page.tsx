import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { listThreadsForCreator } from "@/server/services/message-service";

export default async function CreadorMensajesPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const threads = await listThreadsForCreator(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MENSAJES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Conversaciones</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Solo puedes escribirle a marcas a las que ya estás vinculado.
      </p>

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no te has unido a ninguna marca.{" "}
          <a href="/creador/marketplace" className="text-brand-accent font-medium hover:underline">
            Ve al marketplace →
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          {threads.map((t) => (
            <Link
              key={t.enrollmentId}
              href={`/creador/mensajes/${t.enrollmentId}`}
              className="flex items-center justify-between px-5 py-4 border-b border-brand-line last:border-b-0 hover:bg-brand-bg"
            >
              <p className="text-sm font-medium text-brand-ink">{t.brandName}</p>
              <p className="text-xs text-brand-ink-soft truncate max-w-[300px]">
                {t.lastMessage ? t.lastMessage.body : "Sin mensajes todavía"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
