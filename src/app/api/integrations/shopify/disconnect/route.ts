import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const { storeId } = body;

    let store;
    if (storeId) {
      store = await prisma.store.findFirst({
        where: { id: storeId, userId: user.id },
      });
    } else {
      store = await prisma.store.findFirst({
        where: { userId: user.id },
      });
    }

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    await prisma.store.update({
      where: { id: store.id },
      data: {
        installationStatus: "DISCONNECTED",
        encryptedAccessToken: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Loja Shopify desconectada com sucesso",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao desconectar loja: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
