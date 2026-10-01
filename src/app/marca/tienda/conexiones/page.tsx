import { redirect } from "next/navigation";
import { requireBrandProfile } from "@/lib/current-brand";
import { StoreSettingsTabs } from "@/components/portal/store-settings-tabs";
import { ConnectionsPanel } from "@/components/portal/connections-panel";
import { getWebhookSigningSecret, listBrandWebhooks } from "@/server/services/webhook-service";
import { getDataicoConnection } from "@/server/services/dataico-service";

export default async function TiendaConexionesPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [webhooks, secret, dataico] = await Promise.all([
    listBrandWebhooks(profile.id),
    getWebhookSigningSecret(profile.id),
    getDataicoConnection(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MI TIENDA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">Configuración</h1>
      <StoreSettingsTabs active="conexiones" />
      <ConnectionsPanel
        dataico={
          dataico
            ? {
                // El token nunca viaja completo al navegador.
                accountId: dataico.accountId,
                tokenLast4: dataico.authToken.slice(-4),
                env: dataico.env,
                prefix: dataico.prefix,
                resolutionNumber: dataico.resolutionNumber,
                nextNumber: dataico.nextNumber,
                sendEmail: dataico.sendEmail,
                enabled: dataico.enabled,
              }
            : null
        }
        signingSecret={secret}
        webhooks={webhooks.map((w) => ({
          id: w.id,
          topic: w.topic,
          url: w.url,
          deliveries: w.deliveries.map((d) => ({
            id: d.id,
            topic: d.topic,
            test: d.test,
            status: d.status,
            attempts: d.attempts,
            lastStatusCode: d.lastStatusCode,
            lastError: d.lastError,
            createdAt: d.createdAt.toISOString(),
            payload: JSON.stringify(d.payload, null, 2),
          })),
        }))}
      />
    </div>
  );
}
