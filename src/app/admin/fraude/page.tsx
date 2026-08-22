import { listFraudFlags } from "@/server/services/admin-fraud-service";
import { AdminFraudPanel } from "@/components/portal/admin-fraud-panel";

export default async function AdminFraudePage() {
  const flags = await listFraudFlags();

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">ANTIFRAUDE</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Cola de revisión</h1>
      <AdminFraudPanel flags={flags.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))} />
    </div>
  );
}
