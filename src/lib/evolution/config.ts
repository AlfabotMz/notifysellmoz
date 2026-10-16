/**
 * Configuração da Evolution API a partir do ambiente.
 * A apikey global (AUTHENTICATION_API_KEY no servidor Evolution)
 * pode ser definida aqui para não ter de a colar na UI.
 */
export function getEvolutionDefaultBaseUrl(): string {
  const fromEnv = process.env.EVOLUTION_DEFAULT_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "http://localhost:8080";
}

export function getEvolutionApiKey(): string | null {
  const key = process.env.EVOLUTION_API_KEY?.trim();
  return key ? key : null;
}

export function hasEvolutionApiKey(): boolean {
  return Boolean(getEvolutionApiKey());
}
