import crypto from "crypto";

/**
 * Verifies the Shopify HMAC signature using constant-time comparison
 * @param rawBody The unparsed raw body string or buffer received from Shopify
 * @param hmacHeader The value of X-Shopify-Hmac-Sha256 header
 * @param secret The Shopify API secret or custom webhook secret
 */
export function verifyShopifyHmac(
  rawBody: string | Buffer,
  hmacHeader: string | null | undefined,
  secret: string
): boolean {
  if (!rawBody || !hmacHeader || !secret) {
    return false;
  }

  try {
    const generatedHmac = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    const providedBuffer = Buffer.from(hmacHeader.trim(), "base64");
    const generatedBuffer = Buffer.from(generatedHmac, "base64");

    if (providedBuffer.length !== generatedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, generatedBuffer);
  } catch {
    return false;
  }
}

/**
 * Computes SHA256 hash of payload for idempotency checking
 */
export function computePayloadHash(payload: string | Buffer): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Verifies the HMAC query parameter on Shopify OAuth callbacks.
 * Shopify signs all query params except hmac/signature, sorted alphabetically.
 */
export function verifyShopifyOAuthHmac(
  searchParams: URLSearchParams,
  secret: string
): boolean {
  if (!secret) return false;

  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== "hmac" && key !== "signature") {
      pairs.push(`${key}=${value}`);
    }
  });
  pairs.sort();

  const digest = crypto.createHmac("sha256", secret).update(pairs.join("&")).digest("hex");

  try {
    const provided = Buffer.from(hmac, "hex");
    const generated = Buffer.from(digest, "hex");
    if (provided.length !== generated.length) return false;
    return crypto.timingSafeEqual(provided, generated);
  } catch {
    return false;
  }
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || "";
}

export function createSignedOAuthState(payload: Record<string, string>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function parseSignedOAuthState(state: string): Record<string, string> | null {
  if (!state || !state.includes(".")) return null;

  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  const providedBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
