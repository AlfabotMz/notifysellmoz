import { validateSafeUrl } from "../security/ssrf";

export interface EvolutionConfig {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
}

export interface ConnectionStateResponse {
  state: "open" | "connecting" | "close" | "refused" | "unknown";
  instance: string;
  raw?: any;
}

export interface QrCodeResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  status: "SENT" | "PENDING" | "FAILED" | "UNCERTAIN";
  error?: string;
  isUncertain?: boolean;
}

export class EvolutionApiError extends Error {
  statusCode?: number;
  isRateLimit?: boolean;
  isUncertain?: boolean;

  constructor(message: string, statusCode?: number, isRateLimit?: boolean, isUncertain?: boolean) {
    super(message);
    this.name = "EvolutionApiError";
    this.statusCode = statusCode;
    this.isRateLimit = isRateLimit;
    this.isUncertain = isUncertain;
  }
}

/**
 * Normalizes URL and strips trailing slashes
 */
function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Fetch wrapper with timeout and SSRF validation
 */
async function evolutionFetch(
  baseUrl: string,
  path: string,
  options: RequestInit,
  apiKey: string,
  timeoutMs = 12000
): Promise<Response> {
  const urlCheck = validateSafeUrl(baseUrl);
  if (!urlCheck.valid) {
    throw new EvolutionApiError(`URL da Evolution API inválida ou insegura: ${urlCheck.reason}`);
  }

  const endpoint = `${cleanUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: apiKey,
    ...(options.headers as Record<string, string>),
  };

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new EvolutionApiError("Tempo limite esgotado ao contactar a Evolution API (Timeout)", 504, false, true);
    }
    // Network socket drop or DNS resolution failure
    throw new EvolutionApiError(`Falha de comunicação com o servidor Evolution API: ${err.message}`, 500, false, true);
  }
}

/**
 * Checks general connectivity to the Evolution API instance
 */
export async function checkConnection(config: EvolutionConfig): Promise<ConnectionStateResponse> {
  try {
    const res = await evolutionFetch(
      config.baseUrl,
      `/instance/connectionState/${encodeURIComponent(config.instanceName)}`,
      { method: "GET" },
      config.apiKey,
      8000
    );

    if (res.status === 401 || res.status === 403) {
      throw new EvolutionApiError("Chave de API (apikey) inválida ou não autorizada", res.status);
    }

    if (res.status === 404) {
      throw new EvolutionApiError("Instância não encontrada no servidor Evolution API", 404);
    }

    if (!res.ok) {
      throw new EvolutionApiError(`Servidor Evolution respondeu com erro HTTP ${res.status}`, res.status);
    }

    const data = await res.json();
    const state = (data?.instance?.state || data?.state || "unknown").toLowerCase();

    return {
      state: state === "open" ? "open" : state === "connecting" ? "connecting" : "close",
      instance: config.instanceName,
      raw: data,
    };
  } catch (err: any) {
    if (err instanceof EvolutionApiError) throw err;
    throw new EvolutionApiError(`Erro ao consultar estado da instância: ${err.message}`);
  }
}

/**
 * Creates an instance in Evolution API if it doesn't already exist
 */
export async function createInstance(config: EvolutionConfig): Promise<{ success: boolean; data?: any }> {
  try {
    const res = await evolutionFetch(
      config.baseUrl,
      "/instance/create",
      {
        method: "POST",
        body: JSON.stringify({
          instanceName: config.instanceName,
          token: config.apiKey,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      },
      config.apiKey,
      10000
    );

    if (res.status === 403 || res.status === 401) {
      throw new EvolutionApiError("Não autorizado: Verifique a API Key global ou da instância", res.status);
    }

    const data = await res.json();
    return { success: res.ok, data };
  } catch (err: any) {
    if (err instanceof EvolutionApiError) throw err;
    throw new EvolutionApiError(`Falha ao criar instância: ${err.message}`);
  }
}

/**
 * Retrieves the current QR Code for scanning
 */
export async function getQrCode(config: EvolutionConfig): Promise<QrCodeResponse | null> {
  try {
    const res = await evolutionFetch(
      config.baseUrl,
      `/instance/connect/${encodeURIComponent(config.instanceName)}`,
      { method: "GET" },
      config.apiKey,
      10000
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return {
      base64: data?.base64 || data?.qrcode?.base64 || null,
      code: data?.code || data?.qrcode?.code || null,
      pairingCode: data?.pairingCode || null,
      count: data?.count || 1,
    };
  } catch {
    return null;
  }
}

/**
 * Disconnects / logs out an instance from WhatsApp
 */
export async function logoutInstance(config: EvolutionConfig): Promise<boolean> {
  try {
    const res = await evolutionFetch(
      config.baseUrl,
      `/instance/logout/${encodeURIComponent(config.instanceName)}`,
      { method: "DELETE" },
      config.apiKey,
      8000
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a text message through Evolution API with rate-limit and uncertainty protection
 */
export async function sendTextMessage(
  config: EvolutionConfig,
  recipientNumber: string,
  messageText: string
): Promise<SendMessageResult> {
  // Clean recipient number (remove leading +, spaces, etc)
  const cleanNumber = recipientNumber.replace(/\D/g, "");

  if (!cleanNumber || cleanNumber.length < 8) {
    return {
      success: false,
      status: "FAILED",
      error: "Número de destinatário inválido",
    };
  }

  try {
    const res = await evolutionFetch(
      config.baseUrl,
      `/message/sendText/${encodeURIComponent(config.instanceName)}`,
      {
        method: "POST",
        body: JSON.stringify({
          number: cleanNumber,
          text: messageText,
          options: {
            delay: 1000,
            presence: "composing",
          },
        }),
      },
      config.apiKey,
      15000
    );

    if (res.status === 429) {
      return {
        success: false,
        status: "FAILED",
        error: "Limite de envio atingido na Evolution API (Rate Limit)",
      };
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        success: false,
        status: "FAILED",
        error: `Evolution API retornou erro ${res.status}: ${errBody.substring(0, 150)}`,
      };
    }

    const data = await res.json();
    const messageId = data?.key?.id || data?.messageId || data?.id || null;

    return {
      success: true,
      messageId,
      status: "SENT",
    };
  } catch (err: any) {
    if (err.isUncertain) {
      // Could not confirm if server processed the request before dropping connection
      return {
        success: false,
        status: "UNCERTAIN",
        isUncertain: true,
        error: "Resultado incerto: Conexão interrompida durante o envio. Evitando envio duplicado automático.",
      };
    }

    return {
      success: false,
      status: "FAILED",
      error: err.message || "Erro desconhecido ao enviar mensagem",
    };
  }
}

/**
 * Configures webhook on Evolution API instance for delivery status updates
 */
export async function configureWebhooks(
  config: EvolutionConfig,
  webhookUrl: string
): Promise<boolean> {
  try {
    const res = await evolutionFetch(
      config.baseUrl,
      `/webhook/set/${encodeURIComponent(config.instanceName)}`,
      {
        method: "POST",
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhookByEvents: true,
          events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
        }),
      },
      config.apiKey,
      8000
    );
    return res.ok;
  } catch {
    return false;
  }
}
