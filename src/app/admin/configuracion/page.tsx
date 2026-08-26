import { auth } from "@/auth";
import { getPlatformConfig, getLegalContent } from "@/server/services/admin-config-service";
import { isOwner } from "@/lib/current-admin";
import { PlatformConfigForm } from "@/components/portal/platform-config-form";
import { PlatformQrUpload } from "@/components/portal/platform-qr-upload";
import { LegalContentForm } from "@/components/portal/legal-content-form";

export default async function AdminConfiguracionPage() {
  const session = await auth();
  const [config, legalTerms, legalPrivacy] = await Promise.all([
    getPlatformConfig(),
    getLegalContent("terms"),
    getLegalContent("privacy"),
  ]);
  const readOnly = !isOwner(session!.user.adminRole);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CONFIGURACIÓN</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Configuración global</h1>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Tarifas, fechas y cobro a marcas</h2>
      <div className="mb-10">
        <PlatformConfigForm
          initial={{
            defaultPlatformFeePercent: Number(config.defaultPlatformFeePercent),
            vatPercent: Number(config.vatPercent),
            chargeDayOfMonth: config.chargeDayOfMonth,
            payoutDayOfMonth: config.payoutDayOfMonth,
            refundHoldDays: config.refundHoldDays,
            instantPayoutFeePercent: Number(config.instantPayoutFeePercent),
            paymentInstructions: config.paymentInstructions ?? "",
            paymentGraceHours: config.paymentGraceHours,
            deactivationGraceHours: config.deactivationGraceHours,
          }}
          readOnly={readOnly}
        />
      </div>

      {!readOnly && (
        <>
          <h2 className="font-display font-semibold text-brand-ink mb-4">QR de pago (Bre-B u otro)</h2>
          <div className="mb-10">
            <PlatformQrUpload initialUrl={config.paymentQrImageUrl} />
          </div>
        </>
      )}

      <h2 className="font-display font-semibold text-brand-ink mb-4">Contenido legal (Términos y Condiciones)</h2>
      <div className="mb-10">
        <LegalContentForm
          legalKey="terms"
          initial={{ title: legalTerms?.title ?? "", body: legalTerms?.body ?? "" }}
        />
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Contenido legal (Política de Privacidad)</h2>
      <LegalContentForm
        legalKey="privacy"
        initial={{ title: legalPrivacy?.title ?? "", body: legalPrivacy?.body ?? "" }}
      />
    </div>
  );
}
