/// Eventos que puede escuchar un webhook de Conexiones — mismos nombres
/// de Shopify, para que las URLs que la marca ya tenía allá (Dataico,
/// Google Sheets...) entiendan lo que llega. Compartido entre la página y
/// el servidor.
export const WEBHOOK_TOPICS = [
  { topic: "orders/create", label: "Creación de pedido", hint: "Cuando entra un pedido pagado." },
  { topic: "orders/paid", label: "Pago de pedido", hint: "Cuando se confirma el pago." },
  {
    topic: "orders/updated",
    label: "Actualización de pedido",
    hint: "Cada cambio del pedido: pago, preparación, envío o devolución. Es el que usa Dataico.",
  },
  { topic: "orders/fulfilled", label: "Envío de pedido", hint: "Cuando el pedido sale con su guía." },
  { topic: "customers/create", label: "Creación de cliente", hint: "Cuando compra alguien por primera vez." },
  { topic: "customers/update", label: "Actualización de cliente", hint: "Cuando editas un cliente." },
] as const;

export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number]["topic"];

export function isWebhookTopic(value: string): value is WebhookTopic {
  return WEBHOOK_TOPICS.some((t) => t.topic === value);
}

export function webhookTopicLabel(topic: string) {
  return WEBHOOK_TOPICS.find((t) => t.topic === topic)?.label ?? topic;
}
