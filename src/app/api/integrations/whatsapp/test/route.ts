import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/security/encryption";
import { normalizePhoneNumber } from "@/lib/validation/phone";
import { sendTextMessage } from "@/lib/evolution/client";
import { z } from "zod";

const testSchema = z.object({
  phone: z.string().min(8, "Número de telefone inválido"),
  message: z.string().optional(),
  storeId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = testSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { phone, message, storeId } = parsed.data;

    let store;
    if (storeId) {
      store = await prisma.store.findFirst({
        where: { id: storeId, userId: user.id },
        include: { whatsAppConnection: true },
      });
    } else {
      store = await getOrCreatePrimaryStore(user.id);
    }

    if (!store?.whatsAppConnection?.encryptedApiKey) {
      return NextResponse.json(
        { error: "WhatsApp não está configurado nesta loja" },
        { status: 400 }
      );
    }

    const conn = store.whatsAppConnection;
    const apiKey = decrypt(conn.encryptedApiKey);

    const { normalized, isValid } = normalizePhoneNumber(phone);
    if (!isValid || !normalized) {
      return NextResponse.json(
        { error: "Número de telefone inválido para envio via WhatsApp" },
        { status: 400 }
      );
    }

    const testText =
      message ||
      `👋 *NotifySell Moz - Teste de Conexão*\n\nA sua conexão WhatsApp com a loja *${store.shopName || store.shopDomain}* está a funcionar perfeitamente!\n\nData: ${new Date().toLocaleString("pt-MZ")}`;

    const sendRes = await sendTextMessage(
      {
        baseUrl: conn.evolutionBaseUrl,
        instanceName: conn.instanceName,
        apiKey,
      },
      normalized,
      testText
    );

    if (!sendRes.success) {
      return NextResponse.json(
        { error: sendRes.error || "Falha ao enviar mensagem de teste", details: sendRes },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: sendRes.messageId,
      sentTo: normalized,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro no teste de envio: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
