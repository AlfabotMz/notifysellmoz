import Redis from "ioredis";

let redisConnection: Redis | null = null;

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url || null;
}

export function getRedisConnection(): Redis {
  const url = getRedisUrl();
  if (!url) {
    throw new Error(
      "REDIS_URL é obrigatório. Defina redis://localhost:6379 no .env e suba o Redis (docker compose)."
    );
  }

  if (!redisConnection) {
    redisConnection = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
  }

  return redisConnection;
}
