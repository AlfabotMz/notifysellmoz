import { encrypt, decrypt } from "../security/encryption";

const SHOPIFY_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const SHOPIFY_API_VERSION = "2024-01";

export function getShopifyAppCredentials(): { clientId: string; clientSecret: string; scopes: string } {
  const clientId = process.env.SHOPIFY_API_KEY?.trim() || "";
  const clientSecret = process.env.SHOPIFY_API_SECRET?.trim() || "";
  const scopes = process.env.SHOPIFY_SCOPES?.trim() || "read_orders,read_products,read_customers";

  if (!clientId || !clientSecret) {
    throw new Error(
      "SHOPIFY_API_KEY e SHOPIFY_API_SECRET têm de estar definidos no .env (credenciais da app Partner)."
    );
  }

  return { clientId, clientSecret, scopes };
}

export function getAppBaseUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export interface ShopifyWebhookSubscription {
  id?: number;
  topic: string;
  address: string;
  format: string;
}

/**
 * Validates whether a domain matches standard myshopify.com pattern
 */
export function isValidShopifyDomain(domain: string): boolean {
  if (!domain || typeof domain !== "string") return false;
  const clean = domain.trim().toLowerCase();
  return SHOPIFY_DOMAIN_REGEX.test(clean);
}

/**
 * Normalizes shop input: e.g. "my-store" -> "my-store.myshopify.com"
 */
export function normalizeShopDomain(input: string): string {
  let cleaned = input.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!cleaned.includes(".myshopify.com")) {
    cleaned = `${cleaned}.myshopify.com`;
  }
  return cleaned;
}

/**
 * Generates the Shopify OAuth authorization URL
 */
export function buildOAuthUrl(params: {
  shop: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  state: string;
}): string {
  const { shop, clientId, scopes, redirectUri, state } = params;
  const normalizedShop = normalizeShopDomain(shop);
  return `https://${normalizedShop}/admin/oauth/authorize?client_id=${encodeURIComponent(
    clientId
  )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${encodeURIComponent(state)}`;
}

/**
 * Exchanges authorization code for permanent access token
 */
export async function exchangeCodeForAccessToken(params: {
  shop: string;
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; scope: string }> {
  const { shop, code, clientId, clientSecret } = params;
  const normalizedShop = normalizeShopDomain(shop);

  const response = await fetch(`https://${normalizedShop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao obter token da Shopify: HTTP ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    scope: data.scope,
  };
}

/**
 * Fetches basic Shop information from Shopify Admin API
 */
export async function getShopDetails(shopDomain: string, accessToken: string): Promise<any> {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const response = await fetch(`https://${normalizedShop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar dados da loja Shopify: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.shop;
}

/**
 * Registers required webhooks on Shopify for the store
 */
export async function registerStoreWebhooks(params: {
  shopDomain: string;
  accessToken: string;
  webhookCallbackUrl: string;
}): Promise<{ registered: string[]; existing: string[] }> {
  const { shopDomain, accessToken, webhookCallbackUrl } = params;
  const normalizedShop = normalizeShopDomain(shopDomain);

  // Topics required by NotifySellMoz
  const requiredTopics = ["orders/create", "orders/cancelled", "orders/updated"];

  // 1. Fetch existing webhooks to avoid duplicates
  const listRes = await fetch(
    `https://${normalizedShop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    }
  );

  let existingWebhooks: ShopifyWebhookSubscription[] = [];
  if (listRes.ok) {
    const listData = await listRes.json();
    existingWebhooks = listData.webhooks || [];
  }

  const registered: string[] = [];
  const existing: string[] = [];

  for (const topic of requiredTopics) {
    const alreadyExists = existingWebhooks.find(
      (w) => w.topic === topic && w.address === webhookCallbackUrl
    );

    if (alreadyExists) {
      existing.push(topic);
      continue;
    }

    const createRes = await fetch(
      `https://${normalizedShop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookCallbackUrl,
            format: "json",
          },
        }),
      }
    );

    if (createRes.ok) {
      registered.push(topic);
    }
  }

  return { registered, existing };
}
