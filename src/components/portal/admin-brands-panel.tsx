"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteBrandPanel } from "@/components/portal/delete-brand-panel";
import { EnterAsButton } from "@/components/portal/enter-as-button";

type Brand = {
  id: string;
  userId: string;
  email: string;
  /// Creada sin correo de la dueña: la reclama con el link de acceso (ver
  /// generateBrandAccessLink en admin-brand-service.ts).
  ownerPending: boolean;
  accessTokenExpiresAt: string | null;
  accessLinkCreatedAt: string | null;
  claimedAt: string | null;
  companyName: string;
  city: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  storeType: string;
  storefrontSlug: string | null;
  platformFeePercentOverride: number | null;
  marketplaceVisibilityOverride: "AUTO" | "FORCE_VISIBLE" | "FORCE_HIDDEN";
  marketplaceMissing: string[];
  /// "Lo que falta para vender" (ver go-live-service.ts); null sin tienda.
  goLive: { done: number; total: number; missing: string[] } | null;
  /// Pasarelas con las que cobra y Marcolini no tiene.
  gatewayRequests: string[];
  _count: { offers: number };
  // El query que llena esto ya filtra status != PAID — el tipo incluye PAID
  // solo porque así lo infiere Prisma, nunca llega ese valor en la práctica.
  openCharge: {
    id: string;
    status: "PENDING" | "PROOF_SUBMITTED" | "OVERDUE" | "DEACTIVATED" | "PAID";
    totalAmount: number;
  } | null;
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
};

const statusColor: Record<string, string> = {
  PENDING: "text-amber-600",
  APPROVED: "text-brand-accent",
  REJECTED: "text-red-600",
  PAUSED: "text-brand-ink-soft",
};

const chargeStatusLabel: Record<string, string> = {
  PENDING: "esperando pago",
  PROOF_SUBMITTED: "comprobante en revisión",
  OVERDUE: "vencido — cuenta inhabilitada",
  DEACTIVATED: "vencido — servicio desactivado",
};

function AddBrandForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", companyName: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/marcas/crear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo crear la marca.");
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 border-b border-brand-line bg-brand-accent-soft/40 space-y-3"
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          type="email"
          placeholder="Correo de la dueña (opcional)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="input"
        />
        <input
          type="text"
          required
          placeholder="Nombre de la marca"
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          className="input"
        />
        <input
          type="text"
          placeholder="Ciudad (opcional)"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="input"
        />
      </div>
      <p className="text-xs text-brand-ink-soft">
        Con correo, a la dueña le llega de una vez la invitación para poner su contraseña. Sin correo, la
        marca queda «sin dueña»: la armas tú con «Entrar como» y, cuando esté lista, le generas el link de
        acceso desde esta lista para que ella cree su correo y contraseña.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear marca"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-brand-ink-soft hover:underline"
        >
          Cancelar
        </button>
        <p className="text-xs text-brand-ink-soft">
          Queda aprobada de inmediato y le llega un correo para poner su
          contraseña.
        </p>
      </div>
    </form>
  );
}

function FeeEditor({ brand, onDone }: { brand: Brand; onDone: () => void }) {
  const router = useRouter();
  const [fee, setFee] = useState(brand.platformFeePercentOverride ?? 5);
  const [saving, setSaving] = useState(false);

  async function save(value: number | null) {
    setSaving(true);
    await fetch("/api/admin/marcas/tarifa", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: brand.id, feePercent: value }),
    });
    setSaving(false);
    router.refresh();
    onDone();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={fee}
        onChange={(e) => setFee(Number(e.target.value))}
        className="input w-16 font-mono py-1"
      />
      <button
        onClick={() => save(fee)}
        disabled={saving}
        className="text-xs text-brand-accent hover:underline"
      >
        Guardar
      </button>
      <button
        onClick={() => save(null)}
        disabled={saving}
        className="text-xs text-brand-ink-soft hover:underline"
      >
        Usar default
      </button>
      <button
        onClick={onDone}
        className="text-xs text-brand-ink-soft hover:underline"
      >
        Cancelar
      </button>
    </div>
  );
}

/// Cambiar el link de la tienda ({slug}.marcolini.lat). La marca lo elige
/// una sola vez; desde acá Marcolini lo cambia cuando hace falta, y el
/// link anterior sigue llevando al nuevo. Ver saveStorefrontSlug.
function SlugEditor({ brand, onDone }: { brand: Brand; onDone: () => void }) {
  const router = useRouter();
  const [slug, setSlug] = useState(brand.storefrontSlug ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (
      brand.storefrontSlug &&
      !window.confirm(
        `¿Cambiar ${brand.storefrontSlug} por ${slug}? Los links viejos van a seguir llevando a la tienda.`,
      )
    )
      return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/marcas/link", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: brand.id, slug }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "No se pudo cambiar.");
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          className="input w-36 font-mono py-1 text-xs"
        />
        <button onClick={save} disabled={saving || !slug} className="text-xs text-brand-accent hover:underline">
          {saving ? "..." : "Guardar"}
        </button>
        <button onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600 max-w-56">{error}</p>}
    </div>
  );
}

export function AdminBrandsPanel({
  brands,
  isOwner,
}: {
  brands: Brand[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);
  const [creatingTestBrands, setCreatingTestBrands] = useState(false);
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);

  async function decide(brandId: string, decision: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, decision }),
    });
    setLoadingId(null);
    router.refresh();
  }

  // Link de acceso de una marca sin dueña: se muestra una sola vez, en
  // una fila debajo de la marca, para copiarlo y mandarlo por WhatsApp.
  const [accessLinks, setAccessLinks] = useState<Record<string, { url: string; expiresAt: string }>>({});
  const [accessError, setAccessError] = useState<{ brandId: string; message: string } | null>(null);

  async function generateAccessLink(brandId: string) {
    setLoadingId(brandId);
    setAccessError(null);
    const res = await fetch("/api/admin/marcas/acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    const body = await res.json().catch(() => null);
    setLoadingId(null);
    if (!res.ok) {
      setAccessError({ brandId, message: body?.error ?? "No se pudo generar el link." });
      return;
    }
    setAccessLinks((prev) => ({ ...prev, [brandId]: { url: body.url, expiresAt: body.expiresAt } }));
    router.refresh();
  }

  async function revokeAccessLink(brandId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/acceso", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    setLoadingId(null);
    setAccessLinks((prev) => {
      const next = { ...prev };
      delete next[brandId];
      return next;
    });
    router.refresh();
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Sin permiso de portapapeles: el link queda visible para copiarlo a mano.
    }
  }

  function fecha(iso: string) {
    return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  }

  async function createTestBrands() {
    setCreatingTestBrands(true);
    await fetch("/api/admin/marcas/prueba", { method: "POST" });
    setCreatingTestBrands(false);
    router.refresh();
  }

  async function simulatePending(brandId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/prueba/pendiente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function simulateOverdue(brandId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/prueba/moroso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function simulateDeactivated(brandId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/prueba/desactivada", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function createTestProducts(brandId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/prueba/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function completeOnboarding(brandId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/prueba/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function removeTestCharge(brandId: string, chargeId: string) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/prueba/moroso/quitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chargeId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function setVisibility(
    brandId: string,
    override: "AUTO" | "FORCE_VISIBLE" | "FORCE_HIDDEN",
  ) {
    setLoadingId(brandId);
    await fetch("/api/admin/marcas/visibilidad", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, override }),
    });
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
      <div className="flex justify-end gap-4 px-5 py-3 border-b border-brand-line">
        {isOwner && (
          <button
            onClick={createTestBrands}
            disabled={creatingTestBrands}
            className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
          >
            {creatingTestBrands ? "Creando..." : "Crear 4 marcas de prueba"}
          </button>
        )}
        {!addingBrand && (
          <button
            onClick={() => setAddingBrand(true)}
            className="text-xs text-brand-accent font-medium hover:underline"
          >
            + Agregar marca manualmente
          </button>
        )}
      </div>
      {addingBrand && <AddBrandForm onDone={() => setAddingBrand(false)} />}
      {/* overflow-x-auto en un wrapper propio (no en la tarjeta entera, que
          necesita overflow-hidden para las esquinas redondeadas) — antes la
          tabla se recortaba sin forma de deslizar hacia la derecha en
          mobile, donde no cabían todas las columnas. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[940px]">
          <thead>
            <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
              <th className="px-5 py-3 font-normal">Marca</th>
              <th className="px-5 py-3 font-normal">Tienda</th>
              <th className="px-5 py-3 font-normal">En vivo</th>
              <th className="px-5 py-3 font-normal">Link</th>
              <th className="px-5 py-3 font-normal">Ofertas</th>
              <th className="px-5 py-3 font-normal">Tarifa</th>
              <th className="px-5 py-3 font-normal">Estado</th>
              {isOwner && (
                <th className="px-5 py-3 font-normal">Marketplace</th>
              )}
              <th className="px-5 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {brands.map((b) => (
              <Fragment key={b.id}>
              <tr>
                <td className="px-5 py-3 text-brand-ink">
                  {b.companyName}
                  {b.city && (
                    <span className="text-brand-ink-soft"> · {b.city}</span>
                  )}
                  {b.ownerPending ? (
                    <span className="block text-xs text-amber-600 mt-0.5">
                      Sin dueña
                      {b.accessTokenExpiresAt
                        ? new Date(b.accessTokenExpiresAt) > new Date()
                          ? ` · link enviado, vence el ${fecha(b.accessTokenExpiresAt)}`
                          : " · link vencido"
                        : " · sin link de acceso"}
                    </span>
                  ) : (
                    <span className="block text-xs text-brand-ink-soft mt-0.5">
                      {b.email}
                      {b.claimedAt && ` · activada el ${fecha(b.claimedAt)}`}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-brand-ink-soft">{b.storeType}</td>
                <td className="px-5 py-3">
                  {editingSlugId === b.id ? (
                    <SlugEditor brand={b} onDone={() => setEditingSlugId(null)} />
                  ) : (
                    <button
                      onClick={() => setEditingSlugId(b.id)}
                      title="Cambiar el link de la tienda"
                      className="font-mono text-xs text-brand-ink hover:text-brand-accent"
                    >
                      {b.storefrontSlug ?? "— sin link"}
                    </button>
                  )}
                </td>
                <td className="px-5 py-3">
                  {b.goLive ? (
                    <span
                      title={b.goLive.missing.length > 0 ? `Falta: ${b.goLive.missing.join(" · ")}` : "Lista para vender"}
                      className={`font-mono text-xs ${b.goLive.done === b.goLive.total ? "text-brand-accent" : "text-amber-600"}`}
                    >
                      {b.goLive.done}/{b.goLive.total}
                    </span>
                  ) : (
                    <span className="text-xs text-brand-ink-soft">—</span>
                  )}
                  {b.gatewayRequests.length > 0 && (
                    <p className="text-[11px] text-amber-700 mt-0.5" title="Pasarela que usa y Marcolini no tiene">
                      Cobra con {b.gatewayRequests.join(", ")}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3 font-mono text-brand-ink-soft">
                  {b._count.offers}
                </td>
                <td className="px-5 py-3">
                  {editingFeeId === b.id ? (
                    <FeeEditor brand={b} onDone={() => setEditingFeeId(null)} />
                  ) : (
                    <button
                      onClick={() => setEditingFeeId(b.id)}
                      className="font-mono text-brand-ink hover:text-brand-accent"
                    >
                      {b.platformFeePercentOverride ?? "5 (default)"}%
                    </button>
                  )}
                </td>
                <td
                  className={`px-5 py-3 font-medium ${statusColor[b.status]}`}
                >
                  {statusLabel[b.status]}
                </td>
                {isOwner && (
                  <td className="px-5 py-3">
                    <select
                      value={b.marketplaceVisibilityOverride}
                      onChange={(e) =>
                        setVisibility(
                          b.id,
                          e.target.value as
                            | "AUTO"
                            | "FORCE_VISIBLE"
                            | "FORCE_HIDDEN",
                        )
                      }
                      disabled={loadingId === b.id}
                      title="Fuerza si esta marca aparece en el marketplace del creador, sin importar si completó su onboarding real — para pruebas visuales."
                      className={`input py-1 text-xs ${
                        b.marketplaceVisibilityOverride !== "AUTO"
                          ? "border-brand-accent text-brand-accent font-medium"
                          : ""
                      }`}
                    >
                      <option value="AUTO">Auto (real)</option>
                      <option value="FORCE_VISIBLE">Forzar visible</option>
                      <option value="FORCE_HIDDEN">Forzar oculta</option>
                    </select>
                    {b.marketplaceVisibilityOverride === "AUTO" && (
                      <p
                        className={`text-[11px] mt-1 max-w-[12rem] leading-snug ${
                          b.marketplaceMissing.length === 0 ? "text-green-700" : "text-amber-700"
                        }`}
                      >
                        {b.marketplaceMissing.length === 0
                          ? "Sale en el marketplace"
                          : `No sale. Falta: ${b.marketplaceMissing.join(", ")}`}
                      </p>
                    )}
                  </td>
                )}
                <td className="px-5 py-3">
                  <div className="flex gap-3">
                    {b.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => decide(b.id, "APPROVE")}
                          disabled={loadingId === b.id}
                          className="text-xs text-brand-accent font-medium hover:underline"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => decide(b.id, "REJECT")}
                          disabled={loadingId === b.id}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {b.status === "APPROVED" && (
                      <button
                        onClick={() => decide(b.id, "PAUSE")}
                        disabled={loadingId === b.id}
                        className="text-xs text-brand-ink-soft hover:underline"
                      >
                        Pausar
                      </button>
                    )}
                    {b.status === "PAUSED" && (
                      <button
                        onClick={() => decide(b.id, "REACTIVATE")}
                        disabled={loadingId === b.id}
                        className="text-xs text-brand-accent hover:underline"
                      >
                        Reactivar
                      </button>
                    )}
                    {isOwner && b.status === "APPROVED" && (
                      <>
                        <button
                          onClick={() => completeOnboarding(b.id)}
                          disabled={loadingId === b.id}
                          className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
                          title="Rellena perfil, tienda, cómo-te-cobramos y crea una oferta si no tiene — para ver el portal y el marketplace de esta marca como si ya hubiera terminado el onboarding real."
                        >
                          Completar onboarding
                        </button>
                        {b.openCharge ? (
                          <button
                            onClick={() =>
                              removeTestCharge(b.id, b.openCharge!.id)
                            }
                            disabled={loadingId === b.id}
                            className="text-xs text-brand-ink-soft hover:text-red-600 hover:underline disabled:opacity-50"
                            title={`Corte activo: ${chargeStatusLabel[b.openCharge.status] ?? b.openCharge.status}`}
                          >
                            Quitar corte de prueba
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => simulatePending(b.id)}
                              disabled={loadingId === b.id}
                              className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
                            >
                              Simular Nivel 1
                            </button>
                            <button
                              onClick={() => simulateOverdue(b.id)}
                              disabled={loadingId === b.id}
                              className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
                            >
                              Simular Nivel 2
                            </button>
                            <button
                              onClick={() => simulateDeactivated(b.id)}
                              disabled={loadingId === b.id}
                              className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
                            >
                              Simular Nivel 3
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => createTestProducts(b.id)}
                          disabled={loadingId === b.id}
                          className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
                          title="Crea (o deja tal cual si ya existen) 12 productos de mentira para esta marca — para probar vitrina y colecciones sin tener una tienda real conectada."
                        >
                          Crear productos de prueba
                        </button>
                      </>
                    )}
                    {isOwner && b.ownerPending && (
                      <>
                        <button
                          onClick={() => generateAccessLink(b.id)}
                          disabled={loadingId === b.id}
                          className="text-xs text-brand-accent hover:underline disabled:opacity-50"
                          title="Link de un solo uso que vence a los 7 días: la dueña pone su correo y su contraseña y queda ligada a esta marca."
                        >
                          {b.accessTokenExpiresAt ? "Nuevo link de acceso" : "Generar link de acceso"}
                        </button>
                        {b.accessTokenExpiresAt && (
                          <button
                            onClick={() => revokeAccessLink(b.id)}
                            disabled={loadingId === b.id}
                            className="text-xs text-brand-ink-soft hover:text-red-600 hover:underline disabled:opacity-50"
                          >
                            Anular link
                          </button>
                        )}
                      </>
                    )}
                    {isOwner && (
                      <EnterAsButton userId={b.userId} role="BRAND" />
                    )}
                    {isOwner && (
                      <button
                        onClick={() => setDeletingBrandId(deletingBrandId === b.id ? null : b.id)}
                        disabled={loadingId === b.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {isOwner && deletingBrandId === b.id && (
                <tr>
                  <td colSpan={isOwner ? 9 : 8} className="px-5 py-3 bg-brand-bg">
                    <DeleteBrandPanel brandId={b.id} onClose={() => setDeletingBrandId(null)} />
                  </td>
                </tr>
              )}
              {(accessLinks[b.id] || accessError?.brandId === b.id) && (
                <tr>
                  <td colSpan={isOwner ? 9 : 8} className="px-5 py-3 bg-brand-bg">
                    {accessError?.brandId === b.id && (
                      <p className="text-sm text-red-600">{accessError.message}</p>
                    )}
                    {accessLinks[b.id] && (
                      <div className="rounded-lg border border-brand-line bg-brand-surface p-3 text-xs text-brand-ink space-y-2">
                        <p className="font-medium">Link de acceso para {b.companyName} (se muestra una sola vez):</p>
                        <p className="font-mono break-all select-all">{accessLinks[b.id].url}</p>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => copyText(accessLinks[b.id].url)}
                            className="border border-brand-line rounded-full px-3 py-1 text-brand-ink hover:bg-brand-accent-soft"
                          >
                            Copiar link
                          </button>
                          <span className="text-brand-ink-soft">
                            Mándaselo a la dueña por WhatsApp. Es de un solo uso y vence el{" "}
                            {fecha(accessLinks[b.id].expiresAt)}; si se pierde, genera otro.
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
