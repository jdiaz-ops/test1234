import { redirect } from "next/navigation";
import { requireBrandProfile } from "@/lib/current-brand";
import { SettingsShell } from "@/components/portal/settings-shell";
import { ConnectionsPanel } from "@/components/portal/connections-panel";
import { getWebhookSigningSecret, listBrandWebhooks } from "@/server/services/webhook-service";
import { getDataicoConnection } from "@/server/services/dataico-service";
import { getEnviaConnection } from "@/server/services/envia-service";
import { dataicoAllowed, enviaAllowed } from "@/lib/features";
import { portalUrl } from "@/lib/store-url";

export default async function TiendaConexionesPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  // Dataico solo existe para las tiendas de DATAICO_STORE_SLUGS.
  const showDataico = dataicoAllowed(profile);
  // Envia solo para las de ENVIA_STORE_SLUGS.
  const showEnvia = enviaAllowed(profile);
  const [webhooks, secret, dataico, envia] = await Promise.all([
    listBrandWebhooks(profile.id),
    getWebhookSigningSecret(profile.id),
    showDataico ? getDataicoConnection(profile.id) : null,
    showEnvia ? getEnviaConnection(profile.id) : null,
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
        showEnvia={showEnvia}
        brandTaxId={profile.taxId}
        envia={
          envia
            ? {
                // La llave nunca viaja completa al navegador.
                tokenLast4: envia.apiToken.slice(-4),
                sandbox: envia.sandbox,
                webhookUrl: `${portalUrl()}/api/webhooks/envia/${envia.webhookSecret}`,
                lastWebhookAt: envia.lastWebhookAt?.toISOString() ?? null,
                originName: envia.originName,
                originCompany: envia.originCompany,
                originIdNumber: envia.originIdNumber,
                originPhone: envia.originPhone,
                originEmail: envia.originEmail,
                originStreet: envia.originStreet,
                originRegion: envia.originRegion,
                originCity: envia.originCity,
                originReference: envia.originReference,
                carrier: envia.carrier,
                packageLengthCm: envia.packageLengthCm,
                packageWidthCm: envia.packageWidthCm,
                packageHeightCm: envia.packageHeightCm,
                packageWeightGrams: envia.packageWeightGrams,
                packageContent: envia.packageContent,
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
