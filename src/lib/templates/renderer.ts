/**
 * Template rendering engine for WhatsApp messages
 * Supports: {{customer_name}}, {{order_number}}, {{products}}, {{total}}, {{currency}},
 * {{delivery_address}}, {{customer_phone}}, {{payment_method}}
 */

export interface TemplateVariables {
  customer_name?: string;
  order_number?: string;
  products?: string;
  total?: string | number;
  currency?: string;
  delivery_address?: string;
  customer_phone?: string;
  payment_method?: string;
}

export const ALLOWED_VARIABLES = [
  "customer_name",
  "order_number",
  "products",
  "total",
  "currency",
  "delivery_address",
  "customer_phone",
  "payment_method",
] as const;

export const DEFAULT_TEMPLATES: Record<string, string> = {
  ORDER_CONFIRMATION:
    "Olá {{customer_name}}! Recebemos a sua encomenda #{{order_number}} com sucesso.\n\n" +
    "📦 *Artigos:* {{products}}\n" +
    "💰 *Total a pagar na entrega:* {{total}} {{currency}}\n" +
    "📍 *Endereço:* {{delivery_address}}\n\n" +
    "⚠️ *Nota:* O valor acima deverá ser liquidado no momento da recepção do produto (pagamento contra entrega). A nossa equipa já está a preparar o seu envio!",

  DELIVERY_ASSIGNED:
    "🛵 *NOVA ENTREGA DISPONÍVEL - #{{order_number}}*\n\n" +
    "👤 *Cliente:* {{customer_name}}\n" +
    "📞 *Contacto:* {{customer_phone}}\n" +
    "📍 *Local:* {{delivery_address}}\n" +
    "📦 *Artigos:* {{products}}\n" +
    "💵 *Valor a cobrar na entrega:* {{total}} {{currency}} ({{payment_method}})\n\n" +
    "Por favor, confirme se está a caminho para entrega.",

  OWNER_ALERT:
    "🔔 *Nova Encomenda na Loja - #{{order_number}}*\n\n" +
    "Cliente: {{customer_name}} ({{customer_phone}})\n" +
    "Total: {{total}} {{currency}}\n" +
    "Método: {{payment_method}}\n" +
    "Destino: {{delivery_address}}",

  ORDER_CANCELLED:
    "⚠️ *Notificação de Cancelamento - Encomenda #{{order_number}}*\n\n" +
    "Informamos que a encomenda #{{order_number}} foi cancelada no nosso sistema. Nenhuma entrega ou cobrança será efetuada.",

  PROCESSING_FAILURE:
    "🚨 *Atenção Loja:* A encomenda #{{order_number}} ({{customer_name}}) necessita de revisão manual porque o telefone de contacto está em falta ou é inválido.",
};

/**
 * Validates that template only uses known variables
 */
export function validateTemplate(template: string): { valid: boolean; invalidVars: string[] } {
  const matches = template.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const invalidVars: string[] = [];

  for (const match of matches) {
    const varName = match.replace(/\{\{|\}\}/g, "").trim();
    if (!ALLOWED_VARIABLES.includes(varName as any)) {
      invalidVars.push(varName);
    }
  }

  return {
    valid: invalidVars.length === 0,
    invalidVars,
  };
}

/**
 * Renders a message template by substituting variables
 */
export function renderTemplate(template: string, vars: TemplateVariables): string {
  let rendered = template;

  const mapping: Record<string, string> = {
    customer_name: vars.customer_name || "Estimado(a) Cliente",
    order_number: vars.order_number || "",
    products: vars.products || "Itens da encomenda",
    total: vars.total !== undefined ? String(vars.total) : "0.00",
    currency: vars.currency || "MZN",
    delivery_address: vars.delivery_address || "Endereço indicado na encomenda",
    customer_phone: vars.customer_phone || "Não informado",
    payment_method: vars.payment_method || "Pagamento na Entrega",
  };

  for (const [key, value] of Object.entries(mapping)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    rendered = rendered.replace(regex, value);
  }

  return rendered;
}

/**
 * Generates sample variables for template preview
 */
export function getSampleVariables(): TemplateVariables {
  return {
    customer_name: "Artur Macamo",
    order_number: "1042",
    products: "1x Tênis Casual Preto (Tam 42), 2x Meias de Algodão",
    total: "3.450,00",
    currency: "MZN",
    delivery_address: "Av. Julius Nyerere, nº 1420, Polana, Maputo",
    customer_phone: "+258 84 123 4567",
    payment_method: "Pagamento Contra Entrega (M-Pesa / Dinheiro)",
  };
}
