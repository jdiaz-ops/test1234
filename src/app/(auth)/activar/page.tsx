import Link from "next/link";
import { getBrandByAccessToken } from "@/server/services/admin-brand-service";
import { ClaimBrandAccessForm } from "@/components/portal/claim-brand-access-form";

/// La página del link de acceso que el admin le manda a la dueña de una
/// marca que él armó (ver generateBrandAccessLink): ve su marca y crea su
/// correo y contraseña. Un link vencido o ya usado no muestra nada de la
/// marca.
export default async function ActivarMarcaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const brand = token ? await getBrandByAccessToken(token) : null;

  if (!token || !brand) {
    return (
      <div className="text-center">
        <h1 className="font-display text-lg font-semibold text-brand-ink mb-2">Este link ya no sirve</h1>
        <p className="text-sm text-brand-ink-soft mb-4">
          Puede que haya vencido o que ya se haya usado. Pídele a Marcolini uno nuevo. Si ya creaste tu
          acceso, entra con tu correo.
        </p>
        <Link href="/login" className="text-sm font-medium text-brand-ink hover:underline">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div>
      {brand.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- logo de la marca
        <img src={brand.logoUrl} alt={brand.companyName} className="h-12 w-auto max-w-[160px] object-contain mx-auto mb-4" />
      )}
      <h1 className="font-display text-lg font-semibold text-brand-ink text-center mb-1">
        Tu tienda {brand.companyName} está lista
      </h1>
      <p className="text-sm text-brand-ink-soft text-center mb-6">
        Crea tu acceso para entrar a tu portal en Marcolini.
      </p>
      <ClaimBrandAccessForm token={token} />
    </div>
  );
}
