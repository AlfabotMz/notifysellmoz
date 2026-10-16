import { Queue } from "bullmq";
import { prisma } from "../db/prisma";
import { decrypt } from "../security/encryption";
import { sendTextMessage, EvolutionConfig } from "../evolution/client";
import {
  renderTemplate,
  DEFAULT_TEMPLATES,
  TemplateVariables,
} from "../templates/renderer";
import { forwardToN8n } from "../n8n/client";
import { getRedisConnection } from "./connection";

export const QUEUE_NAME = "shopify-order-notifications";
let notificationQueue: Queue | null = null;

function getNotificationQueue(): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return notificationQueue;
}

export interface OrderNotificationJobData {
  storeId: string;
  orderId: string;
  topic: string;
  payload: any;
}

/**
 * Enqueues an order for asynchronous notification processing
 */
export async function enqueueOrderNotifications(data: OrderNotificationJobData): Promise<void> {
  const queue = getNotificationQueue();
  await queue.add("process-order", data, {
    jobId: `order-${data.orderId}-${data.topic}-${Date.now()}`,
  });
}

async function markWebhookEvents(
  storeId: string,
  orderId: string,
  status: "PROCESSED" | "FAILED" | "IGNORED",
  errorMessage?: string | null
) {
  await prisma.webhookEvent.updateMany({
    where: { storeId, orderId, status: "PENDING" },
    data: {
      status,
      processedAt: new Date(),
      errorMessage: errorMessage || null,
    },
  });
}

/**
 * Main order notification processor
 */
export async function processOrderNotifications(data: OrderNotificationJobData) {
  const { storeId, orderId, topic, payload } = data;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      whatsAppConnection: true,
      recipients: true,
      messageTemplates: true,
    },
  });

  if (!store) {
    throw new Error(`Loja ${storeId} não encontrada para processar notificações`);
  }

  // Mode B: n8n forwarding
  if (store.processingMode === "N8N" && store.n8nWebhookUrl) {
    const forwardResult = await forwardToN8n(
      store.n8nWebhookUrl,
      {
        storeId: store.id,
        shopDomain: store.shopDomain,
        topic,
        order: payload,
        timestamp: new Date().toISOString(),
      },
      store.webhookSecret || "default_n8n_secret"
    );

    await markWebhookEvents(
      storeId,
      orderId,
      forwardResult.success ? "PROCESSED" : "FAILED",
      forwardResult.error || null
    );

    return { forwardedToN8n: true, success: forwardResult.success };
  }

  // Mode A: Direct processing with Evolution API
  if (!store.whatsAppConnection || !store.whatsAppConnection.encryptedApiKey) {
    console.warn(`WhatsApp não configurado para a loja ${store.shopDomain}`);
    await markWebhookEvents(storeId, orderId, "FAILED", "WhatsApp não configurado");
    return { success: false, reason: "WhatsApp não configurado" };
  }

  let apiKey: string;
  try {
    apiKey = decrypt(store.whatsAppConnection.encryptedApiKey);
  } catch (err: any) {
    throw new Error(`Falha ao desencriptar API Key do WhatsApp: ${err.message}`);
  }

  const evolutionConfig: EvolutionConfig = {
    baseUrl: store.whatsAppConnection.evolutionBaseUrl,
    instanceName: store.whatsAppConnection.instanceName,
    apiKey,
  };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error(`Registo da encomenda ${orderId} não encontrado na base de dados`);
  }

  // Helper to fetch custom or default template
  const getTemplate = (type: string): string => {
    const custom = store.messageTemplates.find((t) => t.messageType === type && t.enabled);
    return custom?.content || DEFAULT_TEMPLATES[type] || "";
  };

  // Format product list summary
  const lineItems = payload?.line_items || [];
  const productsSummary =
    lineItems.length > 0
      ? lineItems.map((item: any) => `${item.quantity}x ${item.title}`).join(", ")
      : "Artigos da encomenda";

  // Format payment method text
  const isCod = order.isCashOnDelivery;
  const paymentMethodLabel = isCod
    ? "Pagamento Contra Entrega (Pagar ao receber)"
    : order.financialStatus === "paid"
    ? "Pago Antecipadamente"
    : "Pagamento Pendente";

  const templateVars: TemplateVariables = {
    customer_name: order.customerName,
    order_number: order.orderNumber.replace("#", ""),
    products: productsSummary,
    total: Number(order.totalAmount).toLocaleString("pt-MZ", { minimumFractionDigits: 2 }),
    currency: order.currency,
    delivery_address: order.deliveryAddress || "Endereço indicado na encomenda",
    customer_phone: order.customerPhone || "Não informado",
    payment_method: paymentMethodLabel,
  };

  const results: any[] = [];

  // CASE 1: Order is Cancelled
  if (topic === "orders/cancelled" || order.cancelledAt) {
    const courierRecipient = store.recipients.find((r) => r.type === "DELIVERY" && r.enabled);
    if (courierRecipient && courierRecipient.phone) {
      const cancelTemplate = getTemplate("ORDER_CANCELLED");
      const messageContent = renderTemplate(cancelTemplate, templateVars);

      const notif = await prisma.notification.create({
        data: {
          storeId: store.id,
          orderId: order.id,
          recipientType: "DELIVERY",
          recipientPhone: courierRecipient.phone,
          messageType: "ORDER_CANCELLED",
          messageContent,
          status: "PENDING",
        },
      });

      const sendRes = await sendTextMessage(evolutionConfig, courierRecipient.phone, messageContent);

      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          status: sendRes.status,
          providerMessageId: sendRes.messageId || null,
          lastError: sendRes.error || null,
          attemptCount: 1,
          sentAt: sendRes.success ? new Date() : null,
        },
      });

      results.push({ recipient: "DELIVERY", result: sendRes });
    }
    await markWebhookEvents(storeId, orderId, "PROCESSED");
    return { cancelledProcessed: true, results };
  }

  if (topic === "orders/updated") {
    const alreadyNotified = await prisma.notification.findFirst({
      where: { orderId: order.id, messageType: "ORDER_CONFIRMATION" },
    });
    if (alreadyNotified) {
      await markWebhookEvents(storeId, orderId, "IGNORED", "Atualização de encomenda sem novo envio");
      return { skipped: true, reason: "orders/updated já notificado" };
    }
  }

  // CASE 2: Order does NOT have a valid customer phone (Requires manual review)
  if (!order.phoneValid || !order.customerPhone) {
    // Alert Store Owner if configured
    const ownerRecipient = store.recipients.find((r) => r.type === "OWNER" && r.enabled);
    if (ownerRecipient && ownerRecipient.phone) {
      const failureTemplate = getTemplate("PROCESSING_FAILURE");
      const messageContent = renderTemplate(failureTemplate, templateVars);

      const notif = await prisma.notification.create({
        data: {
          storeId: store.id,
          orderId: order.id,
          recipientType: "OWNER",
          recipientPhone: ownerRecipient.phone,
          messageType: "PROCESSING_FAILURE",
          messageContent,
          status: "PENDING",
        },
      });

      const sendRes = await sendTextMessage(evolutionConfig, ownerRecipient.phone, messageContent);

      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          status: sendRes.status,
          providerMessageId: sendRes.messageId || null,
          lastError: sendRes.error || null,
          attemptCount: 1,
          sentAt: sendRes.success ? new Date() : null,
        },
      });

      results.push({ recipient: "OWNER", alert: "MISSING_PHONE", result: sendRes });
    }

    await markWebhookEvents(
      storeId,
      orderId,
      "PROCESSED",
      "Encomenda sem telefone válido. Marcada para revisão manual."
    );
    return { success: false, reason: "Encomenda sem telefone válido. Marcada para revisão manual.", results };
  }

  // CASE 3: Normal order creation - Send Customer confirmation
  const confirmTemplate = getTemplate("ORDER_CONFIRMATION");
  const customerMessage = renderTemplate(confirmTemplate, templateVars);

  const customerNotif = await prisma.notification.create({
    data: {
      storeId: store.id,
      orderId: order.id,
      recipientType: "CUSTOMER",
      recipientPhone: order.customerPhone,
      messageType: "ORDER_CONFIRMATION",
      messageContent: customerMessage,
      status: "PENDING",
    },
  });

  const customerSendRes = await sendTextMessage(evolutionConfig, order.customerPhone, customerMessage);

  await prisma.notification.update({
    where: { id: customerNotif.id },
    data: {
      status: customerSendRes.status,
      providerMessageId: customerSendRes.messageId || null,
      lastError: customerSendRes.error || null,
      attemptCount: 1,
      sentAt: customerSendRes.success ? new Date() : null,
    },
  });
  results.push({ recipient: "CUSTOMER", result: customerSendRes });

  // CASE 4: Send Delivery Courier alert
  const deliveryRecipient = store.recipients.find((r) => r.type === "DELIVERY" && r.enabled);
  if (deliveryRecipient && deliveryRecipient.phone) {
    const deliveryTemplate = getTemplate("DELIVERY_ASSIGNED");
    const courierMessage = renderTemplate(deliveryTemplate, templateVars);

    const courierNotif = await prisma.notification.create({
      data: {
        storeId: store.id,
        orderId: order.id,
        recipientType: "DELIVERY",
        recipientPhone: deliveryRecipient.phone,
        messageType: "DELIVERY_ASSIGNED",
        messageContent: courierMessage,
        status: "PENDING",
      },
    });

    const courierSendRes = await sendTextMessage(evolutionConfig, deliveryRecipient.phone, courierMessage);

    await prisma.notification.update({
      where: { id: courierNotif.id },
      data: {
        status: courierSendRes.status,
        providerMessageId: courierSendRes.messageId || null,
        lastError: courierSendRes.error || null,
        attemptCount: 1,
        sentAt: courierSendRes.success ? new Date() : null,
      },
    });
    results.push({ recipient: "DELIVERY", result: courierSendRes });
  }

  // CASE 5: Send Owner notification if enabled
  const ownerRecipient = store.recipients.find((r) => r.type === "OWNER" && r.enabled);
  if (ownerRecipient && ownerRecipient.phone) {
    const ownerTemplate = getTemplate("OWNER_ALERT");
    const ownerMessage = renderTemplate(ownerTemplate, templateVars);

    const ownerNotif = await prisma.notification.create({
      data: {
        storeId: store.id,
        orderId: order.id,
        recipientType: "OWNER",
        recipientPhone: ownerRecipient.phone,
        messageType: "OWNER_ALERT",
        messageContent: ownerMessage,
        status: "PENDING",
      },
    });

    const ownerSendRes = await sendTextMessage(evolutionConfig, ownerRecipient.phone, ownerMessage);

    await prisma.notification.update({
      where: { id: ownerNotif.id },
      data: {
        status: ownerSendRes.status,
        providerMessageId: ownerSendRes.messageId || null,
        lastError: ownerSendRes.error || null,
        attemptCount: 1,
        sentAt: ownerSendRes.success ? new Date() : null,
      },
    });
    results.push({ recipient: "OWNER", result: ownerSendRes });
  }

  await markWebhookEvents(storeId, orderId, "PROCESSED");
  return { success: true, results };
}

/**
 * Retries a single failed or uncertain notification
 */
export async function retryNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      store: {
        include: {
          whatsAppConnection: true,
        },
      },
    },
  });

  if (!notification) {
    throw new Error("Notificação não encontrada");
  }

  if (notification.status === "SENT" || notification.status === "DELIVERED") {
    throw new Error("Esta notificação já foi enviada com sucesso anteriormente.");
  }

  const conn = notification.store.whatsAppConnection;
  if (!conn || !conn.encryptedApiKey) {
    throw new Error("Conexão WhatsApp não configurada nesta loja");
  }

  const apiKey = decrypt(conn.encryptedApiKey);
  const config: EvolutionConfig = {
    baseUrl: conn.evolutionBaseUrl,
    instanceName: conn.instanceName,
    apiKey,
  };

  const sendRes = await sendTextMessage(config, notification.recipientPhone, notification.messageContent);

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: sendRes.status,
      providerMessageId: sendRes.messageId || notification.providerMessageId,
      lastError: sendRes.error || null,
      attemptCount: { increment: 1 },
      sentAt: sendRes.success ? new Date() : notification.sentAt,
    },
  });

  return {
    success: sendRes.success,
    error: sendRes.error,
  };
}
