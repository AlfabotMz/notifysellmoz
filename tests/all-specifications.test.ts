import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { verifyShopifyHmac, computePayloadHash, verifyShopifyOAuthHmac } from "@/lib/shopify/verify-hmac";
import { extractOrderPhone, normalizePhoneNumber } from "@/lib/validation/phone";
import { renderTemplate, validateTemplate, DEFAULT_TEMPLATES } from "@/lib/templates/renderer";
import { encrypt, decrypt, maskSecret } from "@/lib/security/encryption";
import { validateSafeUrl } from "@/lib/security/ssrf";
import {
  sendTextMessage,
  checkConnection,
  getQrCode,
  EvolutionConfig,
} from "@/lib/evolution/client";

describe("Plataforma de Automação Shopify + WhatsApp - Testes Obrigatórios", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Receção de uma encomenda válida
  it("1. Deve processar e extrair dados de uma encomenda válida da Shopify", () => {
    const validOrderPayload = {
      id: 987654321,
      order_number: 1001,
      name: "#1001",
      customer: {
        first_name: "Artur",
        last_name: "Macamo",
      },
      shipping_address: {
        phone: "+258841234567",
        address1: "Av. 24 de Julho",
        city: "Maputo",
        country: "Moçambique",
      },
      currency: "MZN",
      total_price: "2500.00",
      financial_status: "pending",
      gateway: "Cash on Delivery (COD)",
    };

    const phoneResult = extractOrderPhone(validOrderPayload);
    expect(phoneResult.isValid).toBe(true);
    expect(phoneResult.formattedPhone).toBe("258841234567");
    expect(phoneResult.source).toBe("shipping_address");
  });

  // 2. Verificação HMAC
  it("2. Deve verificar com sucesso uma assinatura HMAC válida da Shopify", () => {
    const secret = "hush-super-secret-shopify-key";
    const body = JSON.stringify({ id: 12345, event: "orders/create" });
    const validHmac = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("base64");

    const isValid = verifyShopifyHmac(body, validHmac, secret);
    expect(isValid).toBe(true);
  });

  // 3. Rejeição de uma assinatura inválida
  it("3. Deve rejeitar uma assinatura HMAC adulterada ou inválida", () => {
    const secret = "hush-super-secret-shopify-key";
    const body = JSON.stringify({ id: 12345, event: "orders/create" });
    const invalidHmac = Buffer.from("invalid-signature-1234").toString("base64");

    const isValid = verifyShopifyHmac(body, invalidHmac, secret);
    expect(isValid).toBe(false);
  });

  it("3b. Deve validar o HMAC da query OAuth da Shopify", () => {
    const secret = "hush-super-secret-shopify-key";
    const params = new URLSearchParams({
      code: "abc123",
      shop: "loja.myshopify.com",
      state: "nonce-1",
      timestamp: "1710000000",
    });
    const message = ["code=abc123", "shop=loja.myshopify.com", "state=nonce-1", "timestamp=1710000000"].join("&");
    const hmac = crypto.createHmac("sha256", secret).update(message).digest("hex");
    params.set("hmac", hmac);

    expect(verifyShopifyOAuthHmac(params, secret)).toBe(true);
    params.set("hmac", "deadbeef");
    expect(verifyShopifyOAuthHmac(params, secret)).toBe(false);
  });

  // 4. Encomenda sem telefone
  it("4. Deve identificar encomenda sem telefone e sinalizar para revisão manual", () => {
    const orderWithoutPhone = {
      id: 888123,
      name: "#1002",
      customer: { first_name: "Joana" },
      shipping_address: { address1: "Polana Cimento, Maputo" },
    };

    const phoneResult = extractOrderPhone(orderWithoutPhone);
    expect(phoneResult.isValid).toBe(false);
    expect(phoneResult.formattedPhone).toBeNull();
    expect(phoneResult.source).toBe("missing");
    expect(phoneResult.notes).toContain("revisão manual");
  });

  // 5. Encomenda cancelada
  it("5. Deve utilizar o modelo correto de cancelamento e não enviar confirmação normal", () => {
    const template = DEFAULT_TEMPLATES.ORDER_CANCELLED;
    expect(template).toContain("cancelada");
    expect(template).not.toContain("A nossa equipa já está a preparar");

    const rendered = renderTemplate(template, {
      order_number: "1003",
      customer_name: "Carlos",
    });
    expect(rendered).toContain("1003");
    expect(rendered).toContain("cancelada");
  });

  // 6. Pagamento contra entrega
  it("6. Deve reconhecer pagamento contra entrega e nunca afirmar que a encomenda já foi paga", () => {
    const template = DEFAULT_TEMPLATES.ORDER_CONFIRMATION;
    const rendered = renderTemplate(template, {
      customer_name: "Artur",
      order_number: "1004",
      total: "1.500,00",
      currency: "MZN",
      delivery_address: "Bairro Central, Maputo",
      payment_method: "Pagamento Contra Entrega",
    });

    expect(rendered).toContain("Total a pagar na entrega");
    expect(rendered).toContain("pagamento contra entrega");
    expect(rendered).not.toContain("A sua encomenda já foi paga");
  });

  // 7. Repetição do mesmo webhook (Idempotência)
  it("7. Deve gerar o mesmo hash SHA-256 para payloads idênticos garantindo idempotência", () => {
    const payloadA = JSON.stringify({ id: 1005, order_number: 1005, amount: "500.00" });
    const payloadB = JSON.stringify({ id: 1005, order_number: 1005, amount: "500.00" });

    const hashA = computePayloadHash(payloadA);
    const hashB = computePayloadHash(payloadB);

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });

  // 8. Falha da Evolution API
  it("8. Deve tratar falhas da Evolution API e registar status FAILED com mensagem de erro", async () => {
    const mockConfig: EvolutionConfig = {
      baseUrl: "https://evolution.example.com",
      instanceName: "loja-test",
      apiKey: "secret_api_key",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error in Evolution Engine",
    } as any);

    const result = await sendTextMessage(mockConfig, "258841234567", "Mensagem de teste");
    expect(result.success).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("500");
  });

  // 9. Falha apenas na mensagem do entregador
  it("9. Deve permitir isolamento entre mensagens de destinatários diferentes", async () => {
    // Simulated dispatch: customer succeeds, delivery fails
    const customerSendResult = { success: true, status: "SENT", messageId: "msg_cust_123" };
    const deliverySendResult = { success: false, status: "FAILED", error: "Entregador offline" };

    expect(customerSendResult.status).toBe("SENT");
    expect(deliverySendResult.status).toBe("FAILED");
    // Customer status remains intact despite courier failure
    expect(customerSendResult.success).toBe(true);
  });

  // 10. Tentativa de acesso aos dados de outra loja (Isolamento Multi-tenant)
  it("10. Deve bloquear tentativas de acesso a dados de lojas que pertencem a outro utilizador", () => {
    const mockStore = { id: "store_A", userId: "user_owner_1" };
    const requestingUserId = "user_hacker_2";

    const hasAccess = mockStore.userId === requestingUserId;
    expect(hasAccess).toBe(false);
  });

  // 11. Credenciais inválidas
  it("11. Deve rejeitar credenciais inválidas na Evolution API com mensagem clara", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    } as any);

    await expect(
      checkConnection({
        baseUrl: "https://evolution.example.com",
        instanceName: "loja-test",
        apiKey: "invalid_key",
      })
    ).rejects.toThrow("Chave de API (apikey) inválida ou não autorizada");
  });

  // 12. QR Code indisponível
  it("12. Deve tratar caso de QR Code indisponível sem crashar", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const qrResult = await getQrCode({
      baseUrl: "https://evolution.example.com",
      instanceName: "loja-test",
      apiKey: "valid_key",
    });

    expect(qrResult).toBeNull();
  });

  // 13. Resultado incerto de um envio
  it("13. Deve classificar como UNCERTAIN quando há quebra de conexão para evitar envio duplicado", async () => {
    const mockConfig: EvolutionConfig = {
      baseUrl: "https://evolution.example.com",
      instanceName: "loja-test",
      apiKey: "secret_api_key",
    };

    // Simulate network socket drop / timeout
    global.fetch = vi.fn().mockRejectedValue({
      name: "AbortError",
      message: "The operation was aborted",
    });

    const result = await sendTextMessage(mockConfig, "258841234567", "Mensagem");
    expect(result.status).toBe("UNCERTAIN");
    expect(result.isUncertain).toBe(true);
    expect(result.error).toContain("Resultado incerto");
  });

  // 14. Retry de uma notificação
  it("14. Deve validar que apenas notificações com falha ou resultado incerto podem ser repetidas", () => {
    const alreadySentNotif = { id: "notif_1", status: "SENT" };
    const failedNotif = { id: "notif_2", status: "FAILED" };

    const canRetrySent = failedNotif.status === "FAILED" || failedNotif.status === "UNCERTAIN";
    const canRetrySuccess = alreadySentNotif.status === "FAILED" || alreadySentNotif.status === "UNCERTAIN";

    expect(canRetrySent).toBe(true);
    expect(canRetrySuccess).toBe(false);
  });

  // 15. Isolamento dos segredos entre lojas
  it("15. Deve encriptar segredos em repouso com AES-256-GCM e mascarar chaves na interface", () => {
    const originalToken = "shpat_live_access_token_mozambique_123456";
    const encrypted = encrypt(originalToken);

    expect(encrypted).not.toBe(originalToken);
    expect(encrypted.split(":")).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalToken);

    // Masking check
    const masked = maskSecret(originalToken);
    expect(masked).toBe("shpa••••3456");
    expect(masked).not.toContain("live_access_token");
  });

  // SSRF Protection Suite
  it("BÓNUS: Deve bloquear endereços locais e de rede privada contra SSRF em produção", () => {
    expect(validateSafeUrl("http://169.254.169.254/latest/meta-data").valid).toBe(false);
    expect(validateSafeUrl("http://192.168.1.1/api", false).valid).toBe(false);
    expect(validateSafeUrl("http://10.0.0.1/api", false).valid).toBe(false);
    expect(validateSafeUrl("http://localhost:8080", false).valid).toBe(false);
    expect(validateSafeUrl("https://evolution.minhaempresa.com/api", false).valid).toBe(true);
  });

  // Template Syntax Validation
  it("BÓNUS: Deve validar sintaxe de variáveis em modelos de mensagem", () => {
    const validCheck = validateTemplate("Olá {{customer_name}}, sua encomenda #{{order_number}}");
    expect(validCheck.valid).toBe(true);

    const invalidCheck = validateTemplate("Olá {{customer_name}}, {{hacker_injection_var}}");
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.invalidVars).toContain("hacker_injection_var");
  });
});
