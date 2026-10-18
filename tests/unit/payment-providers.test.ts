import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PAYMENT_PROVIDERS,
  credentialScopeFor,
  isCredentialSetComplete,
  paymentProviderName,
  providerForGatewayName,
} from "@/lib/payment-providers";
import { maskCredentials, mergeCredentials, readCredentialStore } from "@/server/payments/credentials";
import {
  buildPayuForm,
  mapPayuState,
  payuConfirmationSignature,
  payuRequestSignature,
  payuResponseSignature,
  payuSignedValue,
} from "@/server/payments/providers/payu";
import {
  buildEpaycoCheckout,
  epaycoSignature,
  mapEpaycoCode,
  readEpaycoTransaction,
  verifyEpaycoSignature,
} from "@/server/payments/providers/epayco";
import { mapMercadoPagoStatus, verifyMercadoPagoSignature } from "@/server/payments/providers/mercado-pago";
import { mapBoldEvent, mapBoldLinkStatus, mapBoldReturnStatus, verifyBoldSignature } from "@/server/payments/providers/bold";
import type { PaymentOrderInput } from "@/server/payments/types";
import { buildShippingZones, isPayOnDeliveryRate } from "@/lib/shopify-shipping";

const ORDER: PaymentOrderInput = {
  orderId: "ord_1",
  reference: "mt_abc",
  amountCents: 1590000,
  currency: "COP",
  description: "Pedido ABCDEF12 en Marca",
  brandName: "Marca",
  buyer: {
    email: "ana@prueba.test",
    fullName: "Ana Pérez",
    firstName: "Ana",
    lastName: "Pérez",
    phone: "313 405 8607",
    idType: "CC",
    idNumber: "1020304050",
    address: "Calle 1 # 2-3",
    city: "Medellín",
  },
  returnUrl: "https://marca.marcolini.lat/pedido/ord_1",
  webhookUrl: "https://marcolini.lat/api/webhooks/payu",
};

describe("catálogo de pasarelas", () => {
  it("reconoce el nombre de cada pasarela integrada y dónde viven sus llaves", () => {
    expect(providerForGatewayName("mercado pago")).toBe("MERCADO_PAGO");
    expect(providerForGatewayName("Wompi")).toBe("WOMPI");
    expect(providerForGatewayName("ePayco")).toBe("EPAYCO");
    expect(providerForGatewayName("Addi")).toBeNull();
    expect(paymentProviderName("BOLD")).toBe("Bold");
    expect(paymentProviderName("NONE")).toBeNull();
    expect(credentialScopeFor("EPAYCO", "PRODUCTION")).toBe("SHARED");
    expect(credentialScopeFor("PAYU", "TEST")).toBe("TEST");
    expect(PAYMENT_PROVIDERS.WOMPI.fields.map((f) => f.key)).toEqual(["publicKey", "privateKey", "eventsKey", "integrityKey"]);
    expect(PAYMENT_PROVIDERS.MERCADO_PAGO.webhook?.path("b1")).toBe("/api/webhooks/mercadopago/b1");
    expect(PAYMENT_PROVIDERS.PAYU.webhook).toBeNull();
  });

  it("sabe cuándo un juego de llaves está completo (las opcionales no cuentan)", () => {
    expect(isCredentialSetComplete("MERCADO_PAGO", { accessToken: "TEST-1" })).toBe(true);
    expect(isCredentialSetComplete("MERCADO_PAGO", { webhookSecret: "x" })).toBe(false);
    expect(isCredentialSetComplete("PAYU", { merchantId: "1", accountId: "2" })).toBe(false);
    expect(isCredentialSetComplete("PAYU", { merchantId: "1", accountId: "2", apiKey: "k" })).toBe(true);
    expect(isCredentialSetComplete("EPAYCO", { publicKey: "p", custId: "c", pKey: "k" })).toBe(true);
    expect(isCredentialSetComplete("BOLD", { apiKey: "i" })).toBe(true);
    expect(isCredentialSetComplete("WOMPI", { publicKey: "p", privateKey: "x" })).toBe(false);
  });

  it("lee el JSON guardado sin romperse con basura, mezcla cambios y enmascara las secretas", () => {
    const store = readCredentialStore({
      MERCADO_PAGO: { TEST: { accessToken: " TEST-1 ", junk: 5 }, OTRO: { a: "b" } },
      PASARELA_RARA: { TEST: { x: "y" } },
      BOLD: "nope",
    });
    expect(store).toEqual({ MERCADO_PAGO: { TEST: { accessToken: "TEST-1" } } });

    // undefined conserva, "" borra, una llave que no existe se ignora.
    let next = mergeCredentials(store, "MERCADO_PAGO", "TEST", { webhookSecret: "s", accessToken: undefined, rara: "x" });
    expect(next.MERCADO_PAGO?.TEST).toEqual({ accessToken: "TEST-1", webhookSecret: "s" });
    next = mergeCredentials(next, "MERCADO_PAGO", "TEST", { webhookSecret: "" });
    expect(next.MERCADO_PAGO?.TEST).toEqual({ accessToken: "TEST-1" });
    next = mergeCredentials(next, "MERCADO_PAGO", "TEST", { accessToken: "" });
    expect(next.MERCADO_PAGO?.TEST).toBeUndefined();

    expect(maskCredentials("PAYU", { merchantId: "508029", apiKey: "4Vj8eK4rloUd272L48hsrarnUA" })).toEqual({
      merchantId: "508029",
      accountId: "",
      apiKey: { saved: true, last4: "rnUA" },
      apiLogin: { saved: false, last4: "" },
    });
  });
});

describe("PayU", () => {
  it("firma el formulario como en el ejemplo de la documentación", () => {
    // MD5("4Vj8eK4rloUd272L48hsrarnUA~508029~TestPayU~3~USD") según PayU.
    expect(
      payuRequestSignature({ apiKey: "4Vj8eK4rloUd272L48hsrarnUA", merchantId: "508029", referenceCode: "TestPayU", amount: "3", currency: "USD" }),
    ).toBe("ba9ffa71559580175585e45ce70b6c37");
  });

  it("el valor de las firmas de vuelta va con un decimal, redondeado hacia arriba desde 5", () => {
    expect(payuSignedValue("150.00")).toBe("150.0");
    expect(payuSignedValue("150.25")).toBe("150.3");
    expect(payuSignedValue("150.34")).toBe("150.3");
    expect(payuSignedValue("150.35")).toBe("150.4");
    expect(payuSignedValue("15900")).toBe("15900.0");
    expect(payuSignedValue(15900)).toBe("15900.0");
    expect(payuSignedValue("15900.5")).toBe("15900.5");
  });

  it("la confirmación y la respuesta se firman sobre el valor redondeado", () => {
    const apiKey = "4Vj8eK4rloUd272L48hsrarnUA";
    const expected = createHash("md5").update(`${apiKey}~508029~mt_abc~15900.0~COP~4`).digest("hex");
    expect(payuConfirmationSignature({ apiKey, merchantId: "508029", referenceSale: "mt_abc", value: "15900.00", currency: "COP", statePol: "4" })).toBe(expected);
    expect(payuResponseSignature({ apiKey, merchantId: "508029", referenceCode: "mt_abc", txValue: "15900", currency: "COP", transactionState: "4" })).toBe(expected);
    expect(mapPayuState("4")).toBe("APPROVED");
    expect(mapPayuState(7)).toBe("PENDING");
    expect(mapPayuState("6")).toBe("DECLINED");
    expect(mapPayuState(null)).toBe("DECLINED");
  });

  it("arma el formulario al sandbox con la firma, el modo de prueba y los datos del comprador", () => {
    const values = { merchantId: "508029", accountId: "512321", apiKey: "4Vj8eK4rloUd272L48hsrarnUA" };
    const { url, fields } = buildPayuForm(values, "TEST", ORDER);
    expect(url).toBe("https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/");
    expect(fields).toMatchObject({
      merchantId: "508029",
      accountId: "512321",
      referenceCode: "mt_abc",
      amount: "15900",
      currency: "COP",
      test: "1",
      buyerEmail: "ana@prueba.test",
      responseUrl: ORDER.returnUrl,
      confirmationUrl: ORDER.webhookUrl,
      extra1: "ord_1",
      telephone: "3134058607",
      payerDocument: "1020304050",
      payerDocumentType: "CC",
      shippingCity: "Medellín",
    });
    expect(fields.signature).toBe(payuRequestSignature({ ...values, referenceCode: "mt_abc", amount: "15900", currency: "COP" }));
    expect(buildPayuForm(values, "PRODUCTION", ORDER).url).toBe("https://checkout.payulatam.com/ppp-web-gateway-payu/");
    expect(buildPayuForm(values, "PRODUCTION", ORDER).fields.test).toBe("0");
    expect(buildPayuForm(values, "TEST", { ...ORDER, amountCents: 1590050 }).fields.amount).toBe("15900.50");
  });
});

describe("ePayco", () => {
  it("verifica la firma de la confirmación con P_CUST_ID_CLIENTE y P_KEY", () => {
    const params = { custId: "9999", pKey: "secreta", refPayco: "ref1", transactionId: "tx1", amount: "15900.00", currency: "COP" };
    const expected = createHash("sha256").update("9999^secreta^ref1^tx1^15900.00^COP").digest("hex");
    expect(epaycoSignature(params)).toBe(expected);
    expect(verifyEpaycoSignature({ ...params, signature: expected.toUpperCase() })).toBe(true);
    expect(verifyEpaycoSignature({ ...params, signature: "0".repeat(64) })).toBe(false);
    expect(mapEpaycoCode("1")).toBe("APPROVED");
    expect(mapEpaycoCode(3)).toBe("PENDING");
    expect(mapEpaycoCode("2")).toBe("DECLINED");
  });

  it("lee lo que manda ePayco y arma la ventana de pago con la referencia y el modo", () => {
    expect(readEpaycoTransaction({ x_ref_payco: 123, x_cod_transaction_state: "1", x_amount: "15900" })).toMatchObject({
      x_ref_payco: "123",
      x_cod_response: "1",
      x_amount: "15900",
    });
    expect(readEpaycoTransaction({ x_amount: "1" })).toBeNull();
    const checkout = buildEpaycoCheckout({ publicKey: "pub", custId: "9999", pKey: "k" }, "TEST", ORDER);
    expect(checkout).toMatchObject({ publicKey: "pub", test: true });
    expect(checkout.data).toMatchObject({
      invoice: "mt_abc",
      amount: "15900",
      currency: "cop",
      country: "co",
      response: ORDER.returnUrl,
      confirmation: ORDER.webhookUrl,
      extra1: "ord_1",
      email_billing: "ana@prueba.test",
      type_doc_billing: "CC",
      number_doc_billing: "1020304050",
    });
    expect(buildEpaycoCheckout({ publicKey: "pub", custId: "9999", pKey: "k" }, "PRODUCTION", ORDER).test).toBe(false);
  });
});

describe("Mercado Pago", () => {
  it("valida x-signature con el manifiesto id;request-id;ts", () => {
    const secret = "clave-secreta";
    const manifest = "id:12345;request-id:req-1;ts:1700000000000;";
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
    const ok = verifyMercadoPagoSignature({ xSignature: `ts=1700000000000,v1=${v1}`, xRequestId: "req-1", dataId: "12345", secret });
    expect(ok).toBe(true);
    expect(verifyMercadoPagoSignature({ xSignature: `ts=1700000000000,v1=${v1}`, xRequestId: "req-1", dataId: "99999", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "12345", secret })).toBe(false);
    // Un id alfanumérico va en minúsculas.
    const v1b = createHmac("sha256", secret).update("id:abc123def;request-id:req-2;ts:5;").digest("hex");
    expect(verifyMercadoPagoSignature({ xSignature: `ts=5,v1=${v1b}`, xRequestId: "req-2", dataId: "ABC123DEF", secret })).toBe(true);
  });

  it("traduce los estados", () => {
    expect(mapMercadoPagoStatus("approved")).toBe("APPROVED");
    expect(mapMercadoPagoStatus("in_process")).toBe("PENDING");
    expect(mapMercadoPagoStatus("pending")).toBe("PENDING");
    expect(mapMercadoPagoStatus("rejected")).toBe("DECLINED");
    expect(mapMercadoPagoStatus("cancelled")).toBe("DECLINED");
  });
});

describe("Bold", () => {
  it("valida x-bold-signature (HMAC del cuerpo en base64 con la llave secreta) y traduce estados", () => {
    const rawBody = JSON.stringify({ type: "SALE_APPROVED", data: { payment_id: "p1", metadata: { reference: "LNK_1" } } });
    const signature = createHmac("sha256", "bold-secret").update(Buffer.from(rawBody).toString("base64")).digest("hex");
    expect(verifyBoldSignature({ rawBody, signature, secretKey: "bold-secret" })).toBe(true);
    expect(verifyBoldSignature({ rawBody, signature, secretKey: "otra" })).toBe(false);
    expect(verifyBoldSignature({ rawBody, signature: null, secretKey: "bold-secret" })).toBe(false);
    expect(mapBoldLinkStatus("PAID")).toBe("APPROVED");
    expect(mapBoldLinkStatus("ACTIVE")).toBe("PENDING");
    expect(mapBoldLinkStatus("PROCESSING")).toBe("PENDING");
    expect(mapBoldLinkStatus("REJECTED")).toBe("DECLINED");
    expect(mapBoldLinkStatus("EXPIRED")).toBe("DECLINED");
    expect(mapBoldEvent("SALE_APPROVED")).toBe("APPROVED");
    expect(mapBoldEvent("SALE_REJECTED")).toBe("DECLINED");
    expect(mapBoldEvent("VOID_APPROVED")).toBeNull();
    expect(mapBoldReturnStatus("approved")).toBe("APPROVED");
    expect(mapBoldReturnStatus("failed")).toBe("DECLINED");
    expect(mapBoldReturnStatus(undefined)).toBeNull();
  });
});

describe("envío contraentrega", () => {
  it("reconoce por el nombre las tarifas en $0 que se pagaban al recibir", () => {
    expect(isPayOnDeliveryRate("EL ENVIO LO PAGAS CONTRAENTREGA", 0)).toBe(true);
    expect(isPayOnDeliveryRate("Pago contra entrega", 0)).toBe(true);
    expect(isPayOnDeliveryRate("Flete al recibir", 0)).toBe(true);
    expect(isPayOnDeliveryRate("Envío gratis", 0)).toBe(false);
    expect(isPayOnDeliveryRate("Envío estándar", 0)).toBe(false);
    // Con precio es un cobro normal, aunque el nombre diga contraentrega.
    expect(isPayOnDeliveryRate("Contraentrega", 12000)).toBe(false);
  });

  it("al leer los fletes de Shopify una tarifa contraentrega entra como tarifa sin precio", () => {
    const { zones } = buildShippingZones({ Antioquia: [{ name: "EL ENVIO LO PAGAS CONTRAENTREGA", price: 0 }] });
    expect(zones).toHaveLength(1);
    expect(zones[0].rates[0]).toEqual({ name: "EL ENVIO LO PAGAS CONTRAENTREGA", price: 0, condition: "NONE", pendingPrice: true });
    const free = buildShippingZones({ Antioquia: [{ name: "Envío", price: 0 }] });
    expect(free.zones[0].rates[0]).toEqual({ name: "Envío gratis", price: 0, condition: "NONE" });
  });
});
