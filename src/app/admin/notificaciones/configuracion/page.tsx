import { listNotificationTypeConfigs, listPendingReviewNotifications } from "@/server/services/notification-service";
import { NotificationTypeEditor } from "@/components/portal/notification-type-editor";
import { NotificationPendingQueue } from "@/components/portal/notification-pending-queue";

const AUDIENCE_LABEL: Record<string, string> = {
  CREATOR: "Creador",
  BRAND: "Marca",
  ADMIN: "Admin",
};

export default async function NotificacionesConfiguracionPage() {
  const [configs, pending] = await Promise.all([listNotificationTypeConfigs(), listPendingReviewNotifications()]);

  const byAudience = new Map<string, typeof configs>();
  for (const c of configs) {
    if (!byAudience.has(c.audience)) byAudience.set(c.audience, []);
    byAudience.get(c.audience)!.push(c);
  }

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">NOTIFICACIONES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Configuración de notificaciones</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-2xl">
        Todos los tipos de notificación que existen en Marcolini — actívalos o apágalos, decide si salen solas
        (Automático) o quedan esperando tu aprobación (Manual), por qué canal salen (App + push, Correo, o ambos), y
        edita el texto exacto que se manda. El correo con diseño propio (cortes, insignias, etc.) sigue siendo el
        mismo — el canal solo lo prende o apaga; para los tipos sin diseño propio, el correo sale con este mismo
        texto.
      </p>

      <NotificationPendingQueue
        items={pending.map((n) => ({
          id: n.id,
          type: n.type,
          message: n.message,
          recipientEmail: n.user.email,
          createdAt: n.createdAt.toISOString(),
        }))}
      />

      {(["CREATOR", "BRAND", "ADMIN"] as const).map((audience) => {
        const list = byAudience.get(audience) ?? [];
        if (list.length === 0) return null;
        return (
          <div key={audience} className="mb-10">
            <h2 className="font-display text-base font-semibold text-brand-ink mb-3">
              {AUDIENCE_LABEL[audience]} ({list.length})
            </h2>
            <NotificationTypeEditor
              configs={list.map((c) => ({
                key: c.key,
                label: c.label,
                enabled: c.enabled,
                mode: c.mode,
                channelApp: c.channelApp,
                channelEmail: c.channelEmail,
                messageTemplate: c.messageTemplate,
                placeholders: c.placeholders,
              }))}
            />
          </div>
        );
      })}
    </div>
  );
}
