import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { decrypt, maskSecret } from "@/lib/security/encryption";
import { checkConnection } from "@/lib/evolution/client";
import { getEvolutionDefaultBaseUrl, hasEvolutionApiKey } from "@/lib/evolution/config";

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

    const envDefaults = {
      defaultBaseUrl: getEvolutionDefaultBaseUrl(),
      hasEnvApiKey: hasEvolutionApiKey(),
    };

    if (!store) {
      return NextResponse.json({ status: "NOT_CONFIGURED", ...envDefaults });
    }

    const conn = store.whatsAppConnection;
    if (!conn) {
      return NextResponse.json({
        configured: false,
        status: "NOT_CONFIGURED",
        storeId: store.id,
        ...envDefaults,
      });
    }

    // Attempt live check if encryptedApiKey exists
    let liveState = conn.connectionStatus;
    let liveError: string | null = conn.lastError;

    if (conn.encryptedApiKey) {
      try {
        const apiKey = decrypt(conn.encryptedApiKey);
        const state = await checkConnection({
          baseUrl: conn.evolutionBaseUrl,
          instanceName: conn.instanceName,
          apiKey,
        });

        liveState = state.state === "open" ? "CONNECTED" : "DISCONNECTED";
        liveError = null;

        // Update database status
        await prisma.whatsAppConnection.update({
          where: { id: conn.id },
          data: {
            connectionStatus: liveState,
            lastError: null,
            connectedAt: liveState === "CONNECTED" ? (conn.connectedAt || new Date()) : null,
          },
        });
      } catch (err: any) {
        liveState = "ERROR";
        liveError = err.message;

        await prisma.whatsAppConnection.update({
          where: { id: conn.id },
          data: {
            connectionStatus: "ERROR",
            lastError: err.message,
          },
        });
      }
    }

    return NextResponse.json({
      configured: true,
      status: liveState,
      instanceName: conn.instanceName,
      evolutionBaseUrl: conn.evolutionBaseUrl,
      maskedApiKey: conn.encryptedApiKey ? maskSecret("sk_live_configured_key") : null,
      connectedAt: conn.connectedAt,
      lastError: liveError,
      storeId: store.id,
      ...envDefaults,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
