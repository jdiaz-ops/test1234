import { auth } from "@/auth";
import { listAdmins } from "@/server/services/admin-team-service";
import { isOwner } from "@/lib/current-admin";
import { AdminTeamPanel } from "@/components/portal/admin-team-panel";

export default async function AdminEquipoPage() {
  const session = await auth();
  const admins = await listAdmins();

  if (!isOwner(session!.user.adminRole)) {
    return (
      <div>
        <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">EQUIPO</p>
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">Equipo interno</h1>
        <p className="text-sm text-brand-ink-soft">Solo el propietario puede gestionar el equipo.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">EQUIPO</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Equipo interno</h1>
      <AdminTeamPanel
        admins={admins.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        currentUserId={session!.user.id}
      />
    </div>
  );
}
