import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWebhookUrl } from "@/server/services/brand-profile-service";
import { StoreConnectionForm } from "@/components/portal/store-connection-form";

const statusLabel: Record<string, string> = {
  NOT_CONNECTED: "No conectada todavía",
  CONNECTED: "Conectada",
  ERROR: "Error de conexión — revisa tus credenciales",
};

export default async function TiendaPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

  const webhookUrl =
    profile.webhookSecret && (profile.storeType === "SHOPIFY" || profile.storeType === "WOOCOMMERCE")
      ? getWebhookUrl(profile.id, profile.storeType)
      : null;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CONEXIÓN DE TIENDA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Tu tienda online</h1>
      <p className="text-sm text-brand-ink-soft mb-2 max-w-lg">
        Conecta tu tienda para que el código de cada creador se cree
        automáticamente y las ventas se detecten solas.
      </p>
      <p className="text-xs font-mono text-brand-ink-soft mb-8">
        Estado: {statusLabel[profile.storeConnectionStatus]}
      </p>

      <StoreConnectionForm
        initial={{
          storeType: profile.storeType,
          storeUrl: profile.storeUrl ?? "",
          shopifyAccessToken: profile.shopifyAccessToken ?? "",
          wooConsumerKey: profile.wooConsumerKey ?? "",
          wooConsumerSecret: profile.wooConsumerSecret ?? "",
        }}
        initialWebhookUrl={webhookUrl}
        initialWebhookSecret={profile.webhookSecret ?? null}
      />
    </div>
  );
}
