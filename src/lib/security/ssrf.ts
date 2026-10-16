import { URL } from "url";

/**
 * Validates a user-provided URL to prevent Server-Side Request Forgery (SSRF)
 * Blocks private IP ranges, loopback, link-local, AWS metadata, and non-http(s) protocols.
 */
export function validateSafeUrl(urlString: string, allowLocalhostForDev = process.env.NODE_ENV !== "production"): { valid: boolean; reason?: string } {
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, reason: "URL é obrigatória" };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { valid: false, reason: "Formato de URL inválido" };
  }

  // Enforce http / https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, reason: "Apenas protocolos HTTP e HTTPS são permitidos" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Allow localhost only if explicitly enabled (e.g. dev environment)
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    if (allowLocalhostForDev) {
      return { valid: true };
    }
    return { valid: false, reason: "Acesso a endereços locais (localhost) não é permitido em produção" };
  }

  // AWS/Cloud metadata IP
  if (hostname === "169.254.169.254" || hostname.startsWith("169.254.")) {
    return { valid: false, reason: "Acesso a metadados de infraestrutura bloqueado" };
  }

  // Check IPv4 private ranges (RFC 1918)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const octet1 = parseInt(match[1], 10);
    const octet2 = parseInt(match[2], 10);

    // 10.0.0.0/8
    if (octet1 === 10 && !allowLocalhostForDev) {
      return { valid: false, reason: "Endereços de rede privada (10.x.x.x) são bloqueados" };
    }
    // 172.16.0.0/12
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31 && !allowLocalhostForDev) {
      return { valid: false, reason: "Endereços de rede privada (172.16-31.x.x) são bloqueados" };
    }
    // 192.168.0.0/16
    if (octet1 === 192 && octet2 === 168 && !allowLocalhostForDev) {
      return { valid: false, reason: "Endereços de rede privada (192.168.x.x) são bloqueados" };
    }
    // 127.0.0.0/8
    if (octet1 === 127 && !allowLocalhostForDev) {
      return { valid: false, reason: "Endereços loopback são bloqueados" };
    }
    // 0.0.0.0
    if (octet1 === 0) {
      return { valid: false, reason: "Endereço nulo bloqueado" };
    }
  }

  return { valid: true };
}
