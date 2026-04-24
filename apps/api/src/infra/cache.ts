import { redis } from "./redis.js";
import { logger } from "../config/logger.js";

/**
 * Thin JSON cache layer over Redis. Every error is swallowed and logged:
 * if Redis is down the API falls back to Postgres instead of 500-ing. Cache
 * is an optimization, never a dependency.
 */

export async function cacheGetJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, key }, "cache.get.failed");
    return null;
  }
}

export async function cacheSetJSON(
  key: string,
  value: unknown,
  ttlSec: number,
): Promise<void> {
  if (ttlSec <= 0) return; // disabled
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch (err) {
    logger.warn({ err, key }, "cache.set.failed");
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, "cache.del.failed");
  }
}
