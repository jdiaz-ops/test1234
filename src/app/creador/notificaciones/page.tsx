import { auth } from "@/auth";
import { listNotifications } from "@/server/services/notification-service";
import { NotificationsList } from "@/components/portal/notifications-list";

export default async function NotificacionesPage() {
  const session = await auth();
  const notifications = await listNotifications(session!.user.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">NOTIFICACIONES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Notificaciones</h1>

      <NotificationsList
        notifications={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
      />
    </div>
  );
}
