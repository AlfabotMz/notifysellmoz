import { NextResponse } from "next/server";
import { requireAuth, requireStoreAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { encrypt, decrypt, maskSecret } from "@/lib/security/encryption";
import { validateSafeUrl } from "@/lib/security/ssrf";
import { checkConnection, createInstance } from "@/lib/evolution/client";
import { getEvolutionApiKey, getEvolutionDefaultBaseUrl } from "@/lib/evolution/config";
import { z } from "zod";

const connectSchema = z.object({
  storeId: z.string().min(1, "storeId é obrigatório"),
  baseUrl: z.string().url("URL base inválida").optional(),
  instanceName: z.string().min(1, "Nome da instância é obrigatório"),
  apiKey: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { storeId, instanceName } = parsed.data;
    const baseUrl = (parsed.data.baseUrl || getEvolutionDefaultBaseUrl()).replace(/\/+$/, "");

    // Multi-tenant check
    await requireStoreAccess(storeId, user.id);

    const existing = await prisma.whatsAppConnection.findUnique({ where: { storeId } });
    let apiKey = parsed.data.apiKey?.trim() || "";
    if (!apiKey && existing?.encryptedApiKey) {
      apiKey = decrypt(existing.encryptedApiKey);
    }
    if (!apiKey) {
      apiKey = getEvolutionApiKey() || "";
    }
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "API Key da Evolution em falta. Defina EVOLUTION_API_KEY no .env ou cole a apikey no formulário.",
        },
        { status: 400 }
      );
    }

    // SSRF Check
    const urlCheck = validateSafeUrl(baseUrl);
    if (!urlCheck.valid) {
      return NextResponse.json(
        { error: `URL do servidor rejeitada por segurança: ${urlCheck.reason}` },
        { status: 400 }
      );
    }

    // Encrypt sensitive API key
    const encryptedApiKey = encrypt(apiKey);

    // Check or create instance in Evolution API
    let connectionStatus = "CONNECTING";
    let lastError: string | null = null;

    try {
      // First try to check existing instance connection
      const state = await checkConnection({ baseUrl, instanceName, apiKey });
      connectionStatus = state.state === "open" ? "CONNECTED" : "DISCONNECTED";
    } catch (err: any) {
      if (err.statusCode === 404) {
        // Try creating instance if it doesn't exist
        try {
          await createInstance({ baseUrl, instanceName, apiKey });
          connectionStatus = "DISCONNECTED";
        } catch (createErr: any) {
          connectionStatus = "ERROR";
          lastError = createErr.message;
        }
      } else {
        connectionStatus = "ERROR";
        lastError = err.message;
      }
    }

    const connection = await prisma.whatsAppConnection.upsert({
      where: { storeId },
      update: {
        evolutionBaseUrl: baseUrl,
        instanceName,
        encryptedApiKey,
        connectionStatus,
        lastError,
        connectedAt: connectionStatus === "CONNECTED" ? new Date() : undefined,
      },
      create: {
        storeId,
        evolutionBaseUrl: baseUrl,
        instanceName,
        encryptedApiKey,
        connectionStatus,
        lastError,
        connectedAt: connectionStatus === "CONNECTED" ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        instanceName: connection.instanceName,
        evolutionBaseUrl: connection.evolutionBaseUrl,
        maskedApiKey: maskSecret(apiKey),
        connectionStatus: connection.connectionStatus,
        lastError: connection.lastError,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao configurar WhatsApp: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : error.name === "ForbiddenError" ? 403 : 500 }
    );
  }
}
