import type { PaymentModeId, PaymentProviderId } from "@/lib/payment-providers";

export type PaymentModeIdLike = PaymentModeId;

/// Lo que todas las pasarelas tienen en común, visto desde Marcolini: un
/// pago termina aprobado, sigue pendiente (PSE, efectivo, revisión) o no
/// se dio. Cada módulo en providers/ traduce sus estados crudos a esto.
export type PaymentOutcome = "APPROVED" | "PENDING" | "DECLINED";

/// Resultado de consultar/recibir un pago — lo que se le aplica al pedido
/// (ver applyPaymentResult en store-order-service.ts).
export type GatewayResult = {
  transactionId: string | null;
  rawStatus: string;
  outcome: PaymentOutcome;
  /// Id del cobro en la pasarela cuando recién se conoce (ePayco lo da al
  /// volver el comprador) — se guarda en StoreOrder.gatewayReference.
  gatewayReference?: string;
};

/// Lo que el checkout necesita para mandar al comprador a pagar. Cada
/// pasarela abre distinto: Wompi es una ventana sobre la tienda (y un
/// link de respaldo), Mercado Pago y Bold son un link al que se va, PayU
/// es un formulario que se envía por POST y ePayco una ventana que abre
/// su propio script.
export type PaymentLaunch =
  | {
      kind: "wompi";
      provider: "WOMPI";
      widget: {
        publicKey: string;
        currency: string;
        amountInCents: number;
        reference: string;
        signature: string;
        redirectUrl: string;
      };
      customerData: Record<string, string>;
      checkoutUrl: string;
    }
  | { kind: "redirect"; provider: PaymentProviderId; url: string }
  | { kind: "form"; provider: "PAYU"; url: string; fields: Record<string, string> }
  | { kind: "epayco"; provider: "EPAYCO"; publicKey: string; test: boolean; data: Record<string, string> };

/// La pasarela respondió algo que no se puede usar (error HTTP, llaves
/// malas, respuesta sin los campos esperados).
export class PaymentGatewayError extends Error {}

/// Datos del comprador que las pasarelas aceptan para precargar su ventana.
export type PaymentBuyer = {
  email: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  idType: string | null;
  idNumber: string | null;
  address: string | null;
  city: string | null;
};

export type PaymentOrderInput = {
  orderId: string;
  reference: string;
  amountCents: number;
  currency: string;
  /// "Pedido A1B2C3D4 en Marca" — lo que ve el comprador en la pasarela.
  description: string;
  brandName: string;
  buyer: PaymentBuyer;
  /// A dónde vuelve el comprador al terminar (la página del pedido).
  returnUrl: string;
  /// A dónde avisa la pasarela (solo las que lo aceptan por cobro).
  webhookUrl: string;
};
