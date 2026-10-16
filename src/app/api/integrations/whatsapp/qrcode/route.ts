import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/security/encryption";
import { getQrCode } from "@/lib/evolution/client";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const storeIdParam = url.searchParams.get("storeId");

    let store;
    if (storeIdParam) {
      store = await prisma.store.findFirst({
        where: { id: storeIdParam, userId: user.id },
        include: { whatsAppConnection: true },
      });
    } else {
      store = await getOrCreatePrimaryStore(user.id);
    }

    if (!store?.whatsAppConnection?.encryptedApiKey) {
      return NextResponse.json(
        { error: "WhatsApp não configurado. Por favor guarde as credenciais primeiro." },
        { status: 400 }
      );
    }

    const conn = store.whatsAppConnection;
    const apiKey = decrypt(conn.encryptedApiKey);

    const qrResult = await getQrCode({
      baseUrl: conn.evolutionBaseUrl,
      instanceName: conn.instanceName,
      apiKey,
    });

    if (!qrResult) {
      return NextResponse.json(
        { error: "QR Code indisponível no momento. Certifique-se de que a instância foi criada e está ativa." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      qrcode: qrResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao obter QR Code: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
