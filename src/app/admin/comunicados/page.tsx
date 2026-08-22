import { listBroadcasts } from "@/server/services/broadcast-service";
import { AdminBroadcastPanel } from "@/components/portal/admin-broadcast-panel";

export default async function AdminComunicadosPage() {
  const broadcasts = await listBroadcasts();

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">COMUNICADOS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Enviar comunicados</h1>
      <p className="text-sm text-brand-ink-soft mb-8">
        Manda un mensaje a todas las marcas aprobadas o a todos los creadores activos, por correo y/o por
        notificación dentro de la plataforma.
      </p>
      <AdminBroadcastPanel
        broadcasts={broadcasts.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() }))}
      />
    </div>
  );
}
