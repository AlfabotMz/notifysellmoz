import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        store: true,
        notifications: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Encomenda não encontrada" }, { status: 404 });
    }

    // Tenant check
    if (order.store.userId !== user.id) {
      return NextResponse.json(
        { error: "Acesso negado aos dados desta encomenda" },
        { status: 403 }
      );
    }

    // Fetch related webhook events
    const events = await prisma.webhookEvent.findMany({
      where: { orderId: order.id },
      orderBy: { receivedAt: "desc" },
    });

    return NextResponse.json({
      order: {
        id: order.id,
        externalOrderId: order.externalOrderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        phoneSource: order.phoneSource,
        phoneValid: order.phoneValid,
        deliveryAddress: order.deliveryAddress,
        currency: order.currency,
        totalAmount: Number(order.totalAmount),
        financialStatus: order.financialStatus,
        paymentMethod: order.paymentMethod,
        isCashOnDelivery: order.isCashOnDelivery,
        cancelledAt: order.cancelledAt,
        createdAt: order.createdAt,
      },
      notifications: order.notifications,
      events,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
