import { auth } from "@/auth";
import { getPlatformConfig, getLegalContent } from "@/server/services/admin-config-service";
import { isOwner } from "@/lib/current-admin";
import { PlatformConfigForm } from "@/components/portal/platform-config-form";
import { LegalContentForm } from "@/components/portal/legal-content-form";

export default async function AdminConfiguracionPage() {
  const session = await auth();
  const [config, legal] = await Promise.all([getPlatformConfig(), getLegalContent("terms")]);
  const readOnly = !isOwner(session!.user.adminRole);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CONFIGURACIÓN</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Configuración global</h1>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Tarifas y fechas</h2>
      <div className="mb-10">
        <PlatformConfigForm
          initial={{
            defaultPlatformFeePercent: Number(config.defaultPlatformFeePercent),
            vatPercent: Number(config.vatPercent),
            chargeDayOfMonth: config.chargeDayOfMonth,
            payoutDayOfMonth: config.payoutDayOfMonth,
            refundHoldDays: config.refundHoldDays,
            instantPayoutFeePercent: Number(config.instantPayoutFeePercent),
          }}
          readOnly={readOnly}
        />
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Contenido legal (Términos y Condiciones)</h2>
      <LegalContentForm
        initial={{ title: legal?.title ?? "", body: legal?.body ?? "" }}
      />
    </div>
  );
}
