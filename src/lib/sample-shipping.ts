import type { SampleShipping } from "@/components/portal/sample-shipping-fields";

/// Su última dirección de muestra (CreatorProfile.savedShipping); si nunca
/// ha pedido una, lo que ya sabemos de su perfil para adelantar campos. La
/// usan las muestras y las Cajas PR.
export function defaultShippingFor(
  profile: {
    savedShipping: unknown;
    legalName: string | null;
    documentId: string | null;
    phone: string | null;
    city: string | null;
  },
  email: string,
): SampleShipping {
  const saved = (profile.savedShipping ?? {}) as Partial<SampleShipping>;
  return {
    shippingName: saved.shippingName ?? profile.legalName ?? "",
    shippingDocument: saved.shippingDocument ?? profile.documentId ?? "",
    shippingEmail: saved.shippingEmail ?? email,
    shippingPhone: saved.shippingPhone ?? profile.phone ?? "",
    shippingRegion: saved.shippingRegion ?? "",
    shippingCity: saved.shippingCity ?? profile.city ?? "",
    shippingAddress: saved.shippingAddress ?? "",
    shippingNotes: saved.shippingNotes ?? "",
  };
}
