import { auth } from "@/auth";
import { listCreators } from "@/server/services/admin-creator-service";
import { AdminCreatorsPanel } from "@/components/portal/admin-creators-panel";
import { isOwner } from "@/lib/current-admin";
import { DeleteTestProfilesButton } from "@/components/portal/delete-test-profiles-button";

export default async function AdminCreadoresPage() {
  const session = await auth();
  const creators = await listCreators();

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CREADORES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Gestión de creadores</h1>
      {isOwner(session!.user.adminRole) && <DeleteTestProfilesButton />}
      <AdminCreatorsPanel creators={creators} isOwner={isOwner(session!.user.adminRole)} />
    </div>
  );
}
