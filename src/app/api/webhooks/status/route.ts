import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const updateWebhookConfigSchema = z.object({
  storeId: z.string().optional(),
  processingMode: z.enum(["DIRECT", "N8N"]).optional(),
  n8nWebhookUrl: z.string().url().optional().or(z.literal("")),
  regenerateSecret: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const storeIdParam = url.searchParams.get("storeId");

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

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const directWebhookUrl = `${appUrl}/api/webhooks/shopify/${store.id}`;

    // Get statistics
    const [totalEvents, lastEvent, recentEvents] = await Promise.all([
      prisma.webhookEvent.count({ where: { storeId: store.id } }),
      prisma.webhookEvent.findFirst({
        where: { storeId: store.id },
        orderBy: { receivedAt: "desc" },
      }),
      prisma.webhookEvent.findMany({
        where: { storeId: store.id },
        orderBy: { receivedAt: "desc" },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      storeId: store.id,
      webhookUrl: directWebhookUrl,
      webhookSecret: store.webhookSecret,
      processingMode: store.processingMode,
      n8nWebhookUrl: store.n8nWebhookUrl,
      totalEvents,
      lastEventReceivedAt: lastEvent?.receivedAt || null,
      lastEventTopic: lastEvent?.topic || null,
      lastEventStatus: lastEvent?.status || null,
      recentEvents,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = updateWebhookConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { storeId: storeIdParam, processingMode, n8nWebhookUrl, regenerateSecret } = parsed.data;

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

    const updateData: any = {};
    if (processingMode) updateData.processingMode = processingMode;
    if (n8nWebhookUrl !== undefined) updateData.n8nWebhookUrl = n8nWebhookUrl || null;
    if (regenerateSecret) {
      updateData.webhookSecret = `whsec_${Math.random().toString(36).substring(2)}${Date.now()}`;
    }

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      processingMode: updated.processingMode,
      n8nWebhookUrl: updated.n8nWebhookUrl,
      webhookSecret: updated.webhookSecret,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao atualizar configurações de webhook: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
