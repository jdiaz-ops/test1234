import { listCreators } from "@/server/services/admin-creator-service";
import { AdminCreatorsPanel } from "@/components/portal/admin-creators-panel";

export default async function AdminCreadoresPage() {
  const creators = await listCreators();

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CREADORES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Gestión de creadores</h1>
      <AdminCreatorsPanel creators={creators} />
    </div>
  );
}
