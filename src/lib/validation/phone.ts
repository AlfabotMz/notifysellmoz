/**
 * Phone number validation and normalization for Mozambique and international formats
 */

export interface PhoneExtractionResult {
  phone: string | null;
  formattedPhone: string | null;
  source: "shipping_address" | "order" | "customer" | "missing";
  isValid: boolean;
  notes?: string;
}

/**
 * Normalizes a phone string into E.164-compatible digits for WhatsApp / Evolution API
 * Evolution API expects country_code + number (e.g. 258841234567)
 */
export function normalizePhoneNumber(rawPhone: string | null | undefined): { normalized: string | null; isValid: boolean } {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { normalized: null, isValid: false };
  }

  // Remove whitespace, dashes, parentheses, dots
  let digits = rawPhone.replace(/\D/g, "");

  if (!digits) {
    return { normalized: null, isValid: false };
  }

  // If starts with "00", remove the leading "00"
  if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }

  // Mozambique specific rules:
  // Mozambican mobile numbers are 9 digits and typically start with 82, 83, 84, 85, 86, 87
  const mozPrefixes = ["82", "83", "84", "85", "86", "87"];

  // Case 1: Local Mozambique number with 9 digits (e.g. 841234567)
  if (digits.length === 9 && mozPrefixes.some((p) => digits.startsWith(p))) {
    return { normalized: `258${digits}`, isValid: true };
  }

  // Case 2: Mozambique number with 258 prefix (12 digits, e.g. 258841234567)
  if (digits.length === 12 && digits.startsWith("258")) {
    const nationalPart = digits.substring(3);
    if (mozPrefixes.some((p) => nationalPart.startsWith(p))) {
      return { normalized: digits, isValid: true };
    }
  }

  // Case 3: Local number with a leading zero e.g. 0841234567 (10 digits)
  if (digits.length === 10 && digits.startsWith("0")) {
    const stripped = digits.substring(1);
    if (mozPrefixes.some((p) => stripped.startsWith(p))) {
      return { normalized: `258${stripped}`, isValid: true };
    }
  }

  // Case 4: International numbers (between 10 and 15 digits according to E.164)
  if (digits.length >= 10 && digits.length <= 15) {
    return { normalized: digits, isValid: true };
  }

  // Invalid length or unrecognized format
  return { normalized: digits.length >= 8 ? digits : null, isValid: digits.length >= 9 && digits.length <= 15 };
}

/**
 * Extracts phone from Shopify Order payload based on priority:
 * 1. shipping_address.phone
 * 2. order.phone (or billing_address.phone)
 * 3. customer.phone (or customer.default_address.phone)
 */
export function extractOrderPhone(orderPayload: any): PhoneExtractionResult {
  const shippingPhone = orderPayload?.shipping_address?.phone;
  const orderPhone = orderPayload?.phone || orderPayload?.billing_address?.phone;
  const customerPhone = orderPayload?.customer?.phone || orderPayload?.customer?.default_address?.phone;

  // 1. Priority: Shipping Address
  if (shippingPhone && typeof shippingPhone === "string" && shippingPhone.trim() !== "") {
    const { normalized, isValid } = normalizePhoneNumber(shippingPhone);
    if (isValid && normalized) {
      return {
        phone: shippingPhone,
        formattedPhone: normalized,
        source: "shipping_address",
        isValid: true,
      };
    }
  }

  // 2. Priority: Order Phone / Billing Phone
  if (orderPhone && typeof orderPhone === "string" && orderPhone.trim() !== "") {
    const { normalized, isValid } = normalizePhoneNumber(orderPhone);
    if (isValid && normalized) {
      return {
        phone: orderPhone,
        formattedPhone: normalized,
        source: "order",
        isValid: true,
      };
    }
  }

  // 3. Priority: Customer profile phone
  if (customerPhone && typeof customerPhone === "string" && customerPhone.trim() !== "") {
    const { normalized, isValid } = normalizePhoneNumber(customerPhone);
    if (isValid && normalized) {
      return {
        phone: customerPhone,
        formattedPhone: normalized,
        source: "customer",
        isValid: true,
      };
    }
  }

  // If we had any raw phone candidate but it was invalid
  const anyRaw = shippingPhone || orderPhone || customerPhone;
  if (anyRaw) {
    const { normalized, isValid } = normalizePhoneNumber(anyRaw);
    return {
      phone: anyRaw,
      formattedPhone: normalized,
      source: shippingPhone ? "shipping_address" : orderPhone ? "order" : "customer",
      isValid: false,
      notes: "Telefone encontrado com formato inválido para WhatsApp. Necessária revisão manual.",
    };
  }

  // No phone found anywhere
  return {
    phone: null,
    formattedPhone: null,
    source: "missing",
    isValid: false,
    notes: "Nenhum telefone encontrado na encomenda. Necessária revisão manual.",
  };
}
