import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const { storeId: storeIdParam } = body;

    let store;
    if (storeIdParam) {
      store = await prisma.store.findFirst({
        where: { id: storeIdParam, userId: user.id },
      });
    } else {
      store = await getOrCreatePrimaryStore(user.id);
    }

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const testOrderNumber = `#TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const testOrderId = `mock_order_${Date.now()}`;

    // Record test webhook event (does NOT dispatch real messages by default, for test safety)
    const event = await prisma.webhookEvent.create({
      data: {
        storeId: store.id,
        externalEventId: `test_wh_${Date.now()}`,
        topic: "orders/create (TESTE)",
        orderId: testOrderId,
        payloadHash: `testhash_${Date.now()}`,
        status: "PROCESSED",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Evento de teste simulado com sucesso para ${testOrderNumber}`,
      eventId: event.id,
      receivedAt: event.receivedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro no teste de webhook: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
