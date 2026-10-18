import { portalUrl, publicStoreUrl } from "@/lib/store-url";
import { orderNumber } from "@/lib/order-math";
import { PAYMENT_PROVIDERS, type PaymentProviderId } from "@/lib/payment-providers";
import {
  buildIntegritySignature,
  fetchWompiTransaction,
  findWompiTransactionByReference,
} from "@/server/integrations/wompi-client";
import type { ActiveGateway } from "@/server/payments/credentials";
import type { GatewayResult, PaymentBuyer, PaymentLaunch, PaymentOrderInput, PaymentOutcome } from "@/server/payments/types";
import {
  createMercadoPagoPreference,
  fetchMercadoPagoPayment,
  findMercadoPagoPaymentByReference,
  mapMercadoPagoStatus,
  type MercadoPagoValues,
} from "@/server/payments/providers/mercado-pago";
import {
  buildPayuForm,
  findPayuTransactionByReference,
  mapPayuApiState,
  mapPayuState,
  payuResponseSignature,
  type PayuValues,
} from "@/server/payments/providers/payu";
import {
  buildEpaycoCheckout,
  fetchEpaycoReference,
  mapEpaycoCode,
  type EpaycoValues,
} from "@/server/payments/providers/epayco";
import { createBoldLink, fetchBoldLink, mapBoldLinkStatus, type BoldValues } from "@/server/payments/providers/bold";

/// Una sola puerta para todas las pasarelas: cómo se manda a pagar
/// (startPayment), cómo se lee el resultado cuando el comprador vuelve
/// (checkPaymentReturn) y cómo se consulta un pedido que quedó pendiente
/// (lookupPayment). No toca la base: quien aplica el resultado al pedido
/// es applyPaymentResult en store-order-service.ts. Ver conversación del
/// 2026-10-18.

/// A dónde vuelve el comprador después de pagar: la página del pedido en
/// el link real de la tienda ({slug}.marcolini.lat o su dominio propio).
/// Antes salía de NEXT_PUBLIC_APP_URL, que no está configurada en
/// producción, y quedaba "http://localhost:3000/…" — el firewall de Wompi
/// rechazaba el pago. Ver conversación del 2026-10-01.
export function paymentReturnUrl(
  brand: { customDomain: string | null; customDomainVerifiedAt: Date | null; storefrontSlug: string | null },
  orderId: string,
) {
  const store = publicStoreUrl(brand);
  return store ? `${store}/pedido/${orderId}` : `${portalUrl()}/t/${brand.storefrontSlug}/pedido/${orderId}`;
}

/// A dónde avisa la pasarela los pagos de una marca. Para Wompi, Mercado
/// Pago y Bold es la misma URL que la marca pega en su panel; PayU y
/// ePayco la reciben dentro de cada cobro.
export function webhookUrlFor(provider: PaymentProviderId, brandId: string): string {
  const spec = PAYMENT_PROVIDERS[provider];
  const path = spec.webhook ? spec.webhook.path(brandId) : provider === "PAYU" ? "/api/webhooks/payu" : "/api/webhooks/epayco";
  return `${portalUrl()}${path}`;
}

export function paymentDescription(reference: string, brandName: string) {
  return `Pedido ${orderNumber(reference)} en ${brandName}`;
}

/// Datos del comprador para precargar la ventana de pago de Wompi
/// (WidgetCheckout, customerData). Solo lo que Wompi acepta: el celular en
/// 10 dígitos y el documento si es CC, CE, NIT o pasaporte.
const WOMPI_LEGAL_ID_TYPES: Record<string, string> = { CC: "CC", CE: "CE", NIT: "NIT", PASAPORTE: "PP" };

export function wompiCustomerData(order: {
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  billingIdType: string | null;
  billingIdNumber: string | null;
}) {
  const data: Record<string, string> = { email: order.buyerEmail, fullName: order.buyerName };
  const phone = order.buyerPhone.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
  if (/^3\d{9}$/.test(phone)) {
    data.phoneNumber = phone;
    data.phoneNumberPrefix = "+57";
  }
  const legalType = order.billingIdType ? WOMPI_LEGAL_ID_TYPES[order.billingIdType] : undefined;
  if (legalType && order.billingIdNumber) {
    data.legalId = order.billingIdNumber.replace(/-\d$/, "").replace(/[^0-9A-Za-z]/g, "");
    data.legalIdType = legalType;
  }
  return data;
}

/// Respaldo si la ventana de Wompi no carga: la página de pago de Wompi
/// (Web Checkout) solo con lo indispensable. Antes llevaba también los
/// datos del comprador y el firewall de Wompi (CloudFront) respondía 403.
/// Ver conversación del 2026-10-01.
export function wompiCheckoutUrl(wompi: {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
  redirectUrl: string;
}) {
  const params = new URLSearchParams({
    "public-key": wompi.publicKey,
    currency: wompi.currency,
    "amount-in-cents": String(wompi.amountInCents),
    reference: wompi.reference,
    "signature:integrity": wompi.signature,
    "redirect-url": wompi.redirectUrl,
  });
  return `https://checkout.wompi.co/p/?${params.toString()}`;
}

export function mapWompiStatus(status: string): PaymentOutcome {
  if (status === "APPROVED") return "APPROVED";
  if (status === "PENDING") return "PENDING";
  return "DECLINED";
}

export function buyerFromOrder(order: {
  buyerEmail: string;
  buyerName: string;
  buyerFirstName: string | null;
  buyerLastName: string | null;
  buyerPhone: string;
  billingIdType: string | null;
  billingIdNumber: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
}): PaymentBuyer {
  return {
    email: order.buyerEmail,
    fullName: order.buyerName,
    firstName: order.buyerFirstName,
    lastName: order.buyerLastName,
    phone: order.buyerPhone,
    idType: order.billingIdType,
    idNumber: order.billingIdNumber,
    address: order.shippingAddress,
    city: order.shippingCity,
  };
}

/// Arma lo que el checkout necesita para mandar a pagar. Mercado Pago y
/// Bold crean el cobro en su API acá mismo (y devuelven el id para poder
/// consultarlo después); Wompi, PayU y ePayco solo firman.
export async function startPayment(
  gateway: ActiveGateway,
  input: PaymentOrderInput,
): Promise<{ launch: PaymentLaunch; gatewayReference: string | null }> {
  switch (gateway.provider) {
    case "WOMPI": {
      const widget = {
        publicKey: gateway.values.publicKey,
        currency: input.currency,
        amountInCents: input.amountCents,
        reference: input.reference,
        signature: buildIntegritySignature({
          reference: input.reference,
          amountInCents: input.amountCents,
          currency: input.currency,
          integrityKey: gateway.values.integrityKey,
        }),
        redirectUrl: input.returnUrl,
      };
      return {
        launch: {
          kind: "wompi",
          provider: "WOMPI",
          widget,
          customerData: wompiCustomerData({
            buyerEmail: input.buyer.email,
            buyerName: input.buyer.fullName,
            buyerPhone: input.buyer.phone,
            billingIdType: input.buyer.idType,
            billingIdNumber: input.buyer.idNumber,
          }),
          checkoutUrl: wompiCheckoutUrl(widget),
        },
        gatewayReference: null,
      };
    }
    case "MERCADO_PAGO": {
      const { preferenceId, url } = await createMercadoPagoPreference(gateway.values as MercadoPagoValues, input);
      return { launch: { kind: "redirect", provider: "MERCADO_PAGO", url }, gatewayReference: preferenceId };
    }
    case "PAYU": {
      const { url, fields } = buildPayuForm(gateway.values as PayuValues, gateway.mode, input);
      return { launch: { kind: "form", provider: "PAYU", url, fields }, gatewayReference: null };
    }
    case "EPAYCO": {
      const { publicKey, test, data } = buildEpaycoCheckout(gateway.values as EpaycoValues, gateway.mode, input);
      return { launch: { kind: "epayco", provider: "EPAYCO", publicKey, test, data }, gatewayReference: null };
    }
    case "BOLD": {
      const { linkId, url } = await createBoldLink(gateway.values as BoldValues, input);
      return { launch: { kind: "redirect", provider: "BOLD", url }, gatewayReference: linkId };
    }
  }
}

type OrderRef = { reference: string; gatewayReference: string | null };

/// Lee el resultado cuando el comprador vuelve a la página del pedido con
/// lo que la pasarela le puso en la URL. Siempre que se puede, el estado
/// se confirma contra la API de la pasarela (lo de la URL es solo una
/// pista); PayU no tiene consulta sin API Login, así que ahí vale su
/// firma. Null si la URL no trae nada útil o no corresponde al pedido.
export async function checkPaymentReturn(
  gateway: ActiveGateway,
  order: OrderRef,
  query: Record<string, string>,
): Promise<GatewayResult | null> {
  switch (gateway.provider) {
    case "WOMPI": {
      const id = query.id;
      if (!id) return null;
      const txn = await fetchWompiTransaction(gateway.mode, gateway.values.publicKey, id);
      if (!txn || txn.reference !== order.reference) return null;
      return { transactionId: txn.id, rawStatus: txn.status, outcome: mapWompiStatus(txn.status) };
    }
    case "MERCADO_PAGO": {
      const paymentId = query.payment_id || query.collection_id;
      if (!paymentId || paymentId === "null") return null;
      const payment = await fetchMercadoPagoPayment(gateway.values as MercadoPagoValues, paymentId);
      if (payment.external_reference !== order.reference) return null;
      return { transactionId: String(payment.id), rawStatus: payment.status, outcome: mapMercadoPagoStatus(payment.status) };
    }
    case "PAYU": {
      const { signature, transactionState, TX_VALUE, referenceCode, currency, transactionId, merchantId } = query;
      if (!signature || !transactionState || !TX_VALUE || !referenceCode || !currency) return null;
      if (referenceCode !== order.reference) return null;
      const values = gateway.values as PayuValues;
      if (merchantId && merchantId !== values.merchantId) return null;
      const expected = payuResponseSignature({
        apiKey: values.apiKey,
        merchantId: values.merchantId,
        referenceCode,
        txValue: TX_VALUE,
        currency,
        transactionState,
      });
      if (expected !== signature.trim().toLowerCase()) return null;
      return { transactionId: transactionId || null, rawStatus: transactionState, outcome: mapPayuState(transactionState) };
    }
    case "EPAYCO": {
      const ref = query.ref_payco;
      if (!ref) return null;
      const tx = await fetchEpaycoReference(ref);
      if (tx.x_id_invoice !== order.reference) return null;
      return {
        transactionId: tx.x_transaction_id ?? tx.x_ref_payco,
        rawStatus: tx.x_cod_response,
        outcome: mapEpaycoCode(tx.x_cod_response),
        gatewayReference: tx.x_ref_payco,
      };
    }
    case "BOLD": {
      if (!order.gatewayReference) return null;
      const link = await fetchBoldLink(gateway.values as BoldValues, order.gatewayReference);
      return { transactionId: link.transactionId, rawStatus: link.status, outcome: mapBoldLinkStatus(link.status) };
    }
  }
}

/// Consulta en la pasarela un pedido que sigue pendiente (conciliación).
/// Null cuando no hay nada registrado todavía o la pasarela no se puede
/// consultar (PayU sin API Login, ePayco sin ref_payco).
export async function lookupPayment(gateway: ActiveGateway, order: OrderRef): Promise<GatewayResult | null> {
  switch (gateway.provider) {
    case "WOMPI": {
      const tx = await findWompiTransactionByReference(gateway.mode, gateway.values.privateKey, order.reference);
      return tx ? { transactionId: tx.id, rawStatus: tx.status, outcome: mapWompiStatus(tx.status) } : null;
    }
    case "MERCADO_PAGO": {
      const payment = await findMercadoPagoPaymentByReference(gateway.values as MercadoPagoValues, order.reference);
      return payment
        ? { transactionId: String(payment.id), rawStatus: payment.status, outcome: mapMercadoPagoStatus(payment.status) }
        : null;
    }
    case "PAYU": {
      const values = gateway.values as PayuValues;
      if (!values.apiLogin) return null;
      const tx = await findPayuTransactionByReference(values, gateway.mode, order.reference);
      return tx ? { transactionId: tx.transactionId, rawStatus: tx.state, outcome: mapPayuApiState(tx.state) } : null;
    }
    case "EPAYCO": {
      if (!order.gatewayReference) return null;
      const tx = await fetchEpaycoReference(order.gatewayReference);
      if (tx.x_id_invoice !== order.reference) return null;
      return {
        transactionId: tx.x_transaction_id ?? tx.x_ref_payco,
        rawStatus: tx.x_cod_response,
        outcome: mapEpaycoCode(tx.x_cod_response),
      };
    }
    case "BOLD": {
      if (!order.gatewayReference) return null;
      const link = await fetchBoldLink(gateway.values as BoldValues, order.gatewayReference);
      return { transactionId: link.transactionId, rawStatus: link.status, outcome: mapBoldLinkStatus(link.status) };
    }
  }
}
