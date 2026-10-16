import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { exchangeCodeForAccessToken, getShopDetails, registerStoreWebhooks, normalizeShopDomain, getShopifyAppCredentials, getAppBaseUrl } from "@/lib/shopify/client";
import { encrypt } from "@/lib/security/encryption";
import { parseSignedOAuthState, verifyShopifyOAuthHmac } from "@/lib/shopify/verify-hmac";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appUrl = getAppBaseUrl();

  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");

  if (!code || !shop || !state) {
    return NextResponse.redirect(`${appUrl}/settings/shopify?error=missing_parameters`);
  }

  let clientId: string;
  let clientSecret: string;
  try {
    ({ clientId, clientSecret } = getShopifyAppCredentials());
  } catch (error: any) {
    return NextResponse.redirect(`${appUrl}/settings/shopify?error=${encodeURIComponent(error.message)}`);
  }

  if (!verifyShopifyOAuthHmac(url.searchParams, clientSecret)) {
    return NextResponse.redirect(`${appUrl}/settings/shopify?error=invalid_oauth_hmac`);
  }

  const decodedState = parseSignedOAuthState(state);
  if (!decodedState?.userId || !decodedState.shop) {
    return NextResponse.redirect(`${appUrl}/settings/shopify?error=invalid_state`);
  }

  const normalizedShop = normalizeShopDomain(shop);
  if (decodedState.shop !== normalizedShop) {
    return NextResponse.redirect(`${appUrl}/settings/shopify?error=shop_mismatch`);
  }

  try {
    const tokenData = await exchangeCodeForAccessToken({
      shop: normalizedShop,
      code,
      clientId,
      clientSecret,
    });

    const encryptedToken = encrypt(tokenData.accessToken);

    let shopName = normalizedShop.replace(".myshopify.com", "");
    try {
      const details = await getShopDetails(normalizedShop, tokenData.accessToken);
      if (details?.name) {
        shopName = details.name;
      }
    } catch (err) {
      console.warn("Não foi possível carregar detalhes adicionais da loja:", err);
    }

    const store = await prisma.store.upsert({
      where: { shopDomain: normalizedShop },
      update: {
        userId: decodedState.userId,
        shopName,
        encryptedAccessToken: encryptedToken,
        scopes: tokenData.scope,
        installationStatus: "ACTIVE",
        lastSyncAt: new Date(),
      },
      create: {
        userId: decodedState.userId,
        shopDomain: normalizedShop,
        shopName,
        encryptedAccessToken: encryptedToken,
        scopes: tokenData.scope,
        installationStatus: "ACTIVE",
        lastSyncAt: new Date(),
        webhookSecret: `whsec_${Math.random().toString(36).substring(2)}${Date.now()}`,
      },
    });

    try {
      const webhookCallbackUrl = `${appUrl}/api/webhooks/shopify/${store.id}`;
      await registerStoreWebhooks({
        shopDomain: normalizedShop,
        accessToken: tokenData.accessToken,
        webhookCallbackUrl,
      });
    } catch (err) {
      console.warn("Erro ao registar webhooks automaticamente na Shopify:", err);
    }

    return NextResponse.redirect(`${appUrl}/settings/shopify?connected=true`);
  } catch (error: any) {
    console.error("Erro no callback Shopify OAuth:", error);
    return NextResponse.redirect(`${appUrl}/settings/shopify?error=${encodeURIComponent(error.message)}`);
  }
}
