import { randomBytes } from "node:crypto";
import type { Response } from "express";
import { redis } from "../../infra/redis.js";
import { env } from "../../config/env.js";

/**
 * Session record stored as JSON in Redis.
 * Key: `sess:{sid}`
 * TTL: idle timeout (refreshed on each access to implement sliding expiry).
 */
export type SessionData = {
  userId: string;
  permVer: number;
  createdAt: number;   // epoch ms
  lastSeenAt: number;  // epoch ms
  expiresAt: number;   // absolute expiry (epoch ms)
};

const keyFor = (sid: string) => `sess:${sid}`;

function newSid(): string {
  // 32 random bytes → 43-char base64url, URL-safe, no padding.
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  userId: string,
  permVer: number,
): Promise<{ sid: string; data: SessionData }> {
  const now = Date.now();
  const sid = newSid();
  const data: SessionData = {
    userId,
    permVer,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + env.SESSION_ABSOLUTE_SEC * 1000,
  };
  await redis.set(keyFor(sid), JSON.stringify(data), "EX", env.SESSION_IDLE_SEC);
  return { sid, data };
}

export async function readSession(sid: string): Promise<SessionData | null> {
  const raw = await redis.get(keyFor(sid));
  if (!raw) return null;
  let data: SessionData;
  try {
    data = JSON.parse(raw) as SessionData;
  } catch {
    await redis.del(keyFor(sid));
    return null;
  }
  // Absolute expiry check
  if (Date.now() >= data.expiresAt) {
    await redis.del(keyFor(sid));
    return null;
  }
  return data;
}

export async function touchSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  data.lastSeenAt = Date.now();
  await redis.set(
    keyFor(sid),
    JSON.stringify(data),
    "EX",
    env.SESSION_IDLE_SEC,
  );
}

export async function destroySession(sid: string): Promise<void> {
  await redis.del(keyFor(sid));
}

export async function destroyAllSessionsForUser(
  userId: string,
): Promise<void> {
  // Small-scale impl: SCAN + check payloads. Replace with a secondary index
  // (`user:{id}:sessions` set) if this grows hot.
  const stream = redis.scanStream({ match: "sess:*", count: 500 });
  for await (const batch of stream as AsyncIterable<string[]>) {
    if (batch.length === 0) continue;
    const values = await redis.mget(...batch);
    const toDel: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      const v = values[i];
      if (!v) continue;
      try {
        const parsed = JSON.parse(v) as SessionData;
        if (parsed.userId === userId) toDel.push(batch[i]!);
      } catch {
        /* ignore */
      }
    }
    if (toDel.length) await redis.del(...toDel);
  }
}

export function setSessionCookie(res: Response, sid: string): void {
  res.cookie(env.SESSION_COOKIE_NAME, sid, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_ABSOLUTE_SEC * 1000,
    signed: true,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    signed: true,
  });
}
