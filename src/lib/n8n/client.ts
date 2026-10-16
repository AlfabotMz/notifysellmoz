import { validateSafeUrl } from "../security/ssrf";
import crypto from "crypto";

export interface N8nForwardPayload {
  storeId: string;
  shopDomain: string;
  topic: string;
  order: any;
  timestamp: string;
}

/**
 * Forwards an authenticated Shopify event to an external n8n workflow
 */
export async function forwardToN8n(
  n8nWebhookUrl: string,
  payload: N8nForwardPayload,
  sharedSecret: string
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  const urlCheck = validateSafeUrl(n8nWebhookUrl);
  if (!urlCheck.valid) {
    return { success: false, error: `URL do n8n inválida ou bloqueada: ${urlCheck.reason}` };
  }

  const rawJson = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", sharedSecret)
    .update(rawJson)
    .digest("hex");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NotifySell-Signature": signature,
        "X-NotifySell-Store-Id": payload.storeId,
        "X-NotifySell-Topic": payload.topic,
      },
      body: rawJson,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `Servidor n8n respondeu com erro HTTP ${response.status}`,
      };
    }

    return { success: true, statusCode: response.status };
  } catch (err: any) {
    return {
      success: false,
      error: `Falha ao contactar webhook do n8n: ${err.message}`,
    };
  }
}
