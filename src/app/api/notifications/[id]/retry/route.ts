import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { retryNotification } from "@/lib/queue/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id },
      include: { store: true },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notificação não encontrada" }, { status: 404 });
    }

    // Tenant check
    if (notification.store.userId !== user.id) {
      return NextResponse.json(
        { error: "Acesso não autorizado a esta notificação" },
        { status: 403 }
      );
    }

    if (notification.status === "SENT" || notification.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Esta notificação já foi enviada com sucesso anteriormente" },
        { status: 400 }
      );
    }

    const result = await retryNotification(notification.id);

    return NextResponse.json({
      success: result.success,
      error: result.error,
      notificationId: notification.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Falha ao repetir notificação: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
