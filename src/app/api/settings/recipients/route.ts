import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { normalizePhoneNumber } from "@/lib/validation/phone";
import { z } from "zod";

const recipientSchema = z.object({
  storeId: z.string().optional(),
  owner: z
    .object({
      name: z.string().optional().default("Proprietário"),
      phone: z.string().optional(),
      enabled: z.boolean().default(false),
      notifyOnNewOrder: z.boolean().default(true),
      notifyOnCancelled: z.boolean().default(true),
      notifyOnFailure: z.boolean().default(true),
    })
    .optional(),
  delivery: z.object({
    name: z.string().min(1, "Nome do entregador é obrigatório"),
    phone: z.string().min(8, "Número de WhatsApp do entregador é obrigatório"),
    enabled: z.boolean().default(true),
    onlyDeliveryOrders: z.boolean().default(true),
  }),
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
        include: { recipients: true },
      });
    } else {
      store = await getOrCreatePrimaryStore(user.id);
    }

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const recipients = store.recipients || [];
    const owner = recipients.find((r) => r.type === "OWNER");
    const delivery = recipients.find((r) => r.type === "DELIVERY");

    let ownerPrefs = { notifyOnNewOrder: true, notifyOnCancelled: true, notifyOnFailure: true };
    if (owner?.notificationPreferences) {
      try {
        ownerPrefs = JSON.parse(owner.notificationPreferences);
      } catch {}
    }

    let deliveryPrefs = { onlyDeliveryOrders: true };
    if (delivery?.notificationPreferences) {
      try {
        deliveryPrefs = JSON.parse(delivery.notificationPreferences);
      } catch {}
    }

    return NextResponse.json({
      storeId: store.id,
      owner: owner
        ? {
            name: owner.name,
            phone: owner.phone,
            enabled: owner.enabled,
            ...ownerPrefs,
          }
        : null,
      delivery: delivery
        ? {
            name: delivery.name,
            phone: delivery.phone,
            enabled: delivery.enabled,
            ...deliveryPrefs,
          }
        : null,
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
    const parsed = recipientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { storeId: storeIdParam, owner, delivery } = parsed.data;

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

    // Save Delivery Recipient (Required)
    const { normalized: deliveryPhone, isValid: isDeliveryValid } = normalizePhoneNumber(delivery.phone);
    if (!isDeliveryValid || !deliveryPhone) {
      return NextResponse.json(
        { error: "Número de WhatsApp do entregador inválido" },
        { status: 400 }
      );
    }

    await prisma.recipient.upsert({
      where: {
        storeId_type: {
          storeId: store.id,
          type: "DELIVERY",
        },
      },
      update: {
        name: delivery.name,
        phone: deliveryPhone,
        enabled: delivery.enabled,
        notificationPreferences: JSON.stringify({
          onlyDeliveryOrders: delivery.onlyDeliveryOrders,
        }),
      },
      create: {
        storeId: store.id,
        type: "DELIVERY",
        name: delivery.name,
        phone: deliveryPhone,
        enabled: delivery.enabled,
        notificationPreferences: JSON.stringify({
          onlyDeliveryOrders: delivery.onlyDeliveryOrders,
        }),
      },
    });

    // Save Owner Recipient (Optional)
    if (owner && owner.phone && owner.phone.trim() !== "") {
      const { normalized: ownerPhone, isValid: isOwnerValid } = normalizePhoneNumber(owner.phone);
      if (isOwnerValid && ownerPhone) {
        await prisma.recipient.upsert({
          where: {
            storeId_type: {
              storeId: store.id,
              type: "OWNER",
            },
          },
          update: {
            name: owner.name || "Proprietário",
            phone: ownerPhone,
            enabled: owner.enabled,
            notificationPreferences: JSON.stringify({
              notifyOnNewOrder: owner.notifyOnNewOrder,
              notifyOnCancelled: owner.notifyOnCancelled,
              notifyOnFailure: owner.notifyOnFailure,
            }),
          },
          create: {
            storeId: store.id,
            type: "OWNER",
            name: owner.name || "Proprietário",
            phone: ownerPhone,
            enabled: owner.enabled,
            notificationPreferences: JSON.stringify({
              notifyOnNewOrder: owner.notifyOnNewOrder,
              notifyOnCancelled: owner.notifyOnCancelled,
              notifyOnFailure: owner.notifyOnFailure,
            }),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Destinatários guardados com sucesso",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao guardar destinatários: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
