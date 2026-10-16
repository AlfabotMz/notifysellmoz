import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);

    const storeIdParam = url.searchParams.get("storeId");
    const search = url.searchParams.get("search") || "";
    const statusFilter = url.searchParams.get("status") || "ALL";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    let store;
    if (storeIdParam) {
      store = await prisma.store.findFirst({
        where: { id: storeIdParam, userId: user.id },
      });
    } else {
      store = await getOrCreatePrimaryStore(user.id);
    }

    if (!store) {
      return NextResponse.json({ orders: [], total: 0 });
    }

    const where: any = {
      storeId: store.id,
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
      ];
    }

    if (statusFilter === "CANCELLED") {
      where.cancelledAt = { not: null };
    } else if (statusFilter === "COD") {
      where.isCashOnDelivery = true;
    } else if (statusFilter === "INVALID_PHONE") {
      where.phoneValid = false;
    } else if (statusFilter === "PAID") {
      where.financialStatus = "paid";
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          notifications: {
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    ]);

    // Format orders for UI table
    const formatted = orders.map((o) => {
      const customerNotif = o.notifications.find((n) => n.recipientType === "CUSTOMER");
      const deliveryNotif = o.notifications.find((n) => n.recipientType === "DELIVERY");
      const ownerNotif = o.notifications.find((n) => n.recipientType === "OWNER");

      const lastError =
        customerNotif?.lastError || deliveryNotif?.lastError || ownerNotif?.lastError || null;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        phoneValid: o.phoneValid,
        deliveryAddress: o.deliveryAddress,
        totalAmount: Number(o.totalAmount),
        currency: o.currency,
        financialStatus: o.financialStatus,
        paymentMethod: o.paymentMethod,
        isCashOnDelivery: o.isCashOnDelivery,
        cancelledAt: o.cancelledAt,
        createdAt: o.createdAt,
        customerStatus: customerNotif ? customerNotif.status : "NOT_SENT",
        deliveryStatus: deliveryNotif ? deliveryNotif.status : "NOT_SENT",
        ownerStatus: ownerNotif ? ownerNotif.status : "NOT_SENT",
        lastError,
        notificationsCount: o.notifications.length,
      };
    });

    return NextResponse.json({
      orders: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
