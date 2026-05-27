import { Redis as UpstashRedis } from "@upstash/redis";
import Redis from "ioredis";

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
}

let client: RedisLike | null | undefined;

function createClient(): RedisLike | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    const upstash = new UpstashRedis({ url: upstashUrl, token: upstashToken });
    return {
      get: async (key) => {
        const value = await upstash.get<string>(key);
        return value ?? null;
      },
      set: async (key, value, ttlSeconds) => {
        if (ttlSeconds) {
          await upstash.set(key, value, { ex: ttlSeconds });
          return;
        }
        await upstash.set(key, value);
      },
      del: async (...keys) => {
        if (keys.length > 0) {
          await upstash.del(...keys);
        }
      },
      incr: async (key) => Number(await upstash.incr(key)),
      expire: async (key, seconds) => {
        await upstash.expire(key, seconds);
      },
    };
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl !== "redis://localhost:6379") {
    const io = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });

    return {
      get: async (key) => io.get(key),
      set: async (key, value, ttlSeconds) => {
        if (ttlSeconds) {
          await io.set(key, value, "EX", ttlSeconds);
          return;
        }
        await io.set(key, value);
      },
      del: async (...keys) => {
        if (keys.length > 0) {
          await io.del(...keys);
        }
      },
      incr: async (key) => io.incr(key),
      expire: async (key, seconds) => {
        await io.expire(key, seconds);
      },
    };
  }

  return null;
}

function getClient(): RedisLike | null {
  if (client === undefined) {
    client = createClient();
  }
  return client;
}

export function buildAvailabilityCacheKey(
  tenantId: string,
  staffId: string,
  date: string,
  serviceId: string
) {
  return `availability:${tenantId}:${staffId}:${date}:${serviceId}`;
}

export function buildAvailabilitySummaryCacheKey(tenantId: string, date: string) {
  return `availability-summary:${tenantId}:${date}`;
}

export async function invalidateAvailabilityCache(
  tenantId: string,
  staffId: string,
  dateKey: string,
  serviceId?: string,
  serviceIds?: string[]
): Promise<void> {
  const redis = getClient();
  if (!redis) {
    return;
  }

  try {
    const keys: string[] = [];

    if (serviceId) {
      keys.push(buildAvailabilityCacheKey(tenantId, staffId, dateKey, serviceId));
    } else if (serviceIds?.length) {
      for (const id of serviceIds) {
        keys.push(buildAvailabilityCacheKey(tenantId, staffId, dateKey, id));
      }
    }

    keys.push(buildAvailabilitySummaryCacheKey(tenantId, dateKey));

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Cache is optional.
  }
}

export async function getCachedAvailability<T>(key: string): Promise<T | null> {
  const redis = getClient();
  if (!redis) {
    return null;
  }

  try {
    const cached = await redis.get(key);
    if (!cached) {
      return null;
    }
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function setCachedAvailability<T>(
  key: string,
  value: T,
  ttlSeconds = 120
): Promise<void> {
  const redis = getClient();
  if (!redis) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(value), ttlSeconds);
  } catch {
    // Ignore cache write failures.
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getClient();
  if (!redis) {
    return { allowed: true, remaining: limit };
  }

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
    };
  } catch {
    return { allowed: true, remaining: limit };
  }
}

export function isRedisConfigured(): boolean {
  return getClient() !== null;
}
