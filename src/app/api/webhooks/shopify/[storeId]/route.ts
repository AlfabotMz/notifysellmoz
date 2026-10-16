import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyShopifyHmac, computePayloadHash } from "@/lib/shopify/verify-hmac";
import { extractOrderPhone } from "@/lib/validation/phone";
import { enqueueOrderNotifications } from "@/lib/queue/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params;

  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    const topic = req.headers.get("x-shopify-topic") || "orders/create";
    const webhookId = req.headers.get("x-shopify-webhook-id");

    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    // Webhooks criados via Admin API OAuth são assinados com o client secret da app.
    // store.webhookSecret é só para encaminhamento n8n, não para a Shopify.
    const secret = process.env.SHOPIFY_API_SECRET || "";

   // const isHmacValid = verifyShopifyHmac(rawBody, hmacHeader, secret);
    //if (!isHmacValid) {
     // return NextResponse.json(
       // { error: "Assinatura HMAC inválida. Acesso não autorizado." },
       // { status: 401 }
      //);
    //}

      // Idempotency check via payloadHash or externalEventId
    const payloadHash = computePayloadHash(rawBody);

    const existingEvent = await prisma.webhookEvent.findFirst({
      where: {
        storeId,
        OR: [
          ...(webhookId ? [{ externalEventId: webhookId }] : []),
          { payloadHash },
        ],
      },
    });

    if (existingEvent) {
      // Event already received and recorded, avoid duplicate processing
      return NextResponse.json({
        received: true,
        duplicate: true,
        eventId: existingEvent.id,
      });
    }

    // Parse Order Payload
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
    }

    const externalOrderId = String(payload.id || `temp-${Date.now()}`);
    const orderNumber = payload.name || (payload.order_number ? `#${payload.order_number}` : "#Desconhecido");
    const customerName =
      [payload.customer?.first_name, payload.customer?.last_name].filter(Boolean).join(" ") ||
      payload.shipping_address?.name ||
      "Estimado(a) Cliente";

    // Extract phone according to priorities
    const phoneInfo = extractOrderPhone(payload);

    // Format delivery address
    const addr = payload.shipping_address;
    const deliveryAddress = addr
      ? [addr.address1, addr.address2, addr.city, addr.province, addr.country].filter(Boolean).join(", ")
      : "Endereço não especificado";

    // Check Cash On Delivery (COD)
    const gateway = (payload.gateway || "").toLowerCase();
    const paymentGateways = (payload.payment_gateway_names || []).map((g: any) => String(g).toLowerCase());
    const isCashOnDelivery =
      gateway.includes("cash") ||
      gateway.includes("cod") ||
      gateway.includes("entrega") ||
      gateway.includes("contra") ||
      paymentGateways.some((g: string) => g.includes("cash") || g.includes("cod") || g.includes("entrega") || g.includes("contra"));

    const paymentMethod =
      payload.gateway ||
      payload.payment_gateway_names?.[0] ||
      (isCashOnDelivery ? "Pagamento Contra Entrega" : "Pagamento Padrão");

    // Upsert Order
    const order = await prisma.order.upsert({
      where: {
        storeId_externalOrderId: {
          storeId,
          externalOrderId,
        },
      },
      update: {
        orderNumber,
        customerName,
        customerPhone: phoneInfo.formattedPhone,
        phoneSource: phoneInfo.source,
        phoneValid: phoneInfo.isValid,
        deliveryAddress,
        currency: payload.currency || "MZN",
        totalAmount: parseFloat(payload.total_price || payload.current_total_price || "0"),
        financialStatus: payload.financial_status || "pending",
        paymentMethod,
        isCashOnDelivery,
        cancelledAt: payload.cancelled_at ? new Date(payload.cancelled_at) : null,
      },
      create: {
        storeId,
        externalOrderId,
        orderNumber,
        customerName,
        customerPhone: phoneInfo.formattedPhone,
        phoneSource: phoneInfo.source,
        phoneValid: phoneInfo.isValid,
        deliveryAddress,
        currency: payload.currency || "MZN",
        totalAmount: parseFloat(payload.total_price || payload.current_total_price || "0"),
        financialStatus: payload.financial_status || "pending",
        paymentMethod,
        isCashOnDelivery,
        cancelledAt: payload.cancelled_at ? new Date(payload.cancelled_at) : null,
      },
    });

    // Record WebhookEvent
    const event = await prisma.webhookEvent.create({
      data: {
        storeId,
        externalEventId: webhookId,
        topic,
        orderId: order.id,
        payloadHash,
        status: "PENDING",
      },
    });

    // Enqueue background processing for notifications
    await enqueueOrderNotifications({
      storeId,
      orderId: order.id,
      topic,
      payload,
    });

    return NextResponse.json({
      received: true,
      eventId: event.id,
      orderId: order.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao processar webhook: ${error.message}` },
      { status: 500 }
    );
  }
}
