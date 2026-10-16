import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const storeIdParam = url.searchParams.get("storeId");

    let store;
    if (storeIdParam) {
      store = await prisma.store.findFirst({
        where: { id: storeIdParam, userId: user.id },
        include: {
          whatsAppConnection: true,
        },
      });
    } else {
      store = await getOrCreatePrimaryStore(user.id);
    }

    if (!store) {
      return NextResponse.json({
        hasAnyData: false,
        shopifyConnected: false,
        whatsappConnected: false,
        ordersCount: 0,
        clientSentCount: 0,
        deliverySentCount: 0,
        failedCount: 0,
        recentOrders: [],
        recentErrors: [],
      });
    }

    const [
      ordersCount,
      clientSentCount,
      deliverySentCount,
      failedCount,
      recentOrders,
      recentErrors,
    ] = await Promise.all([
      prisma.order.count({ where: { storeId: store.id } }),
      prisma.notification.count({
        where: { storeId: store.id, recipientType: "CUSTOMER", status: "SENT" },
      }),
      prisma.notification.count({
        where: { storeId: store.id, recipientType: "DELIVERY", status: "SENT" },
      }),
      prisma.notification.count({
        where: { storeId: store.id, status: "FAILED" },
      }),
      prisma.order.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          notifications: true,
        },
      }),
      prisma.notification.findMany({
        where: { storeId: store.id, status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          order: true,
        },
      }),
    ]);

    const shopifyConnected = store.installationStatus === "ACTIVE";
    const whatsappConnected = store.whatsAppConnection?.connectionStatus === "CONNECTED";
    const hasAnyData = ordersCount > 0 || !!store.lastSyncAt;

    return NextResponse.json({
      hasAnyData,
      store: {
        id: store.id,
        shopDomain: store.shopDomain,
        shopName: store.shopName,
      },
      shopifyConnected,
      shopifyStatus: store.installationStatus,
      whatsappConnected,
      whatsappStatus: store.whatsAppConnection?.connectionStatus || "NOT_CONFIGURED",
      ordersCount,
      clientSentCount,
      deliverySentCount,
      failedCount,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        totalAmount: Number(o.totalAmount),
        currency: o.currency,
        createdAt: o.createdAt,
        isCashOnDelivery: o.isCashOnDelivery,
        status: o.cancelledAt ? "CANCELLED" : o.financialStatus,
      })),
      recentErrors: recentErrors.map((e) => ({
        id: e.id,
        orderNumber: e.order?.orderNumber || "Desconhecido",
        recipientType: e.recipientType,
        recipientPhone: e.recipientPhone,
        lastError: e.lastError || "Erro de envio",
        createdAt: e.updatedAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
