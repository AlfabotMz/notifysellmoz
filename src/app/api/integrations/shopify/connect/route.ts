import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { isValidShopifyDomain, normalizeShopDomain, buildOAuthUrl, getShopifyAppCredentials, getAppBaseUrl } from "@/lib/shopify/client";
import { createSignedOAuthState } from "@/lib/shopify/verify-hmac";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return NextResponse.json({ error: "Parâmetro 'shop' é obrigatório" }, { status: 400 });
    }

    const normalizedShop = normalizeShopDomain(shop);
    if (!isValidShopifyDomain(normalizedShop)) {
      return NextResponse.json(
        { error: "Domínio de loja Shopify inválido. Utilize o formato 'exemplo.myshopify.com'" },
        { status: 400 }
      );
    }

    const { clientId, scopes } = getShopifyAppCredentials();
    const appUrl = getAppBaseUrl();
    const redirectUri = `${appUrl}/api/integrations/shopify/callback`;

    const state = createSignedOAuthState({
      userId: user.id,
      shop: normalizedShop,
      nonce: Math.random().toString(36).substring(2),
    });

    const authUrl = buildOAuthUrl({
      shop: normalizedShop,
      clientId,
      scopes,
      redirectUri,
      state,
    });

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao iniciar conexão Shopify: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
