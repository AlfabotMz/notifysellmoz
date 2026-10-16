import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const user = await requireAuth();
    const store = await prisma.store.findFirst({
      where: { userId: user.id },
    });

    if (!store) {
      return NextResponse.json({
        connected: false,
        status: "NOT_CONFIGURED",
      });
    }

    return NextResponse.json({
      connected: store.installationStatus === "ACTIVE" && Boolean(store.encryptedAccessToken),
      status: store.installationStatus,
      storeId: store.id,
      shopDomain: store.shopDomain,
      shopName: store.shopName,
      lastSyncAt: store.lastSyncAt,
      hasToken: Boolean(store.encryptedAccessToken),
      scopes: store.scopes || process.env.SHOPIFY_SCOPES || "read_orders,read_products,read_customers",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
