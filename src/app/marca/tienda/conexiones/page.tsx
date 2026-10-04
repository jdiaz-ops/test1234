import { redirect } from "next/navigation";
import { requireBrandProfile } from "@/lib/current-brand";
import { SettingsShell } from "@/components/portal/settings-shell";
import { ConnectionsPanel } from "@/components/portal/connections-panel";
import { getWebhookSigningSecret, listBrandWebhooks } from "@/server/services/webhook-service";
import { getDataicoConnection } from "@/server/services/dataico-service";
import { dataicoAllowed } from "@/lib/features";

export default async function TiendaConexionesPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  // Dataico solo existe para las tiendas de DATAICO_STORE_SLUGS.
  const showDataico = dataicoAllowed(profile);
  const [webhooks, secret, dataico] = await Promise.all([
    listBrandWebhooks(profile.id),
    getWebhookSigningSecret(profile.id),
    showDataico ? getDataicoConnection(profile.id) : null,
  ]);

  return (
    <SettingsShell active="conexiones">
      <ConnectionsPanel
        showDataico={showDataico}
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
    </SettingsShell>
  );
}
