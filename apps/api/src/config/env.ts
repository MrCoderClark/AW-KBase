import { z } from "zod";

/**
 * Fail-fast env validation. Throws on boot if any required var is missing.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().default(4000),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string().url(),

  // Auth
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be ≥32 chars"),
  SESSION_COOKIE_NAME: z.string().default("kb_session"),
  SESSION_IDLE_SEC: z.coerce.number().int().default(1800),
  SESSION_ABSOLUTE_SEC: z.coerce.number().int().default(12 * 3600),

  // CORS
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),

  // Logging
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // Caching — TTL for article detail cache. Set to 0 to disable.
  ARTICLE_CACHE_TTL_SEC: z.coerce.number().int().min(0).default(300),

  // Search — Meilisearch. If MEILI_HOST is empty the API soft-degrades
  // (search endpoint returns 503; mutations skip enqueueing reindex jobs).
  MEILI_HOST: z.string().url().optional(),
  MEILI_MASTER_KEY: z.string().optional(),
  SEARCH_INDEX_NAME: z.string().default("articles"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

const data = parsed.data;

// __Host- cookie prefix requires Secure + HTTPS. Strip in non-production
// so dev over http://localhost works without browser/client cookie rejection.
if (data.NODE_ENV !== "production" && data.SESSION_COOKIE_NAME.startsWith("__Host-")) {
  data.SESSION_COOKIE_NAME = data.SESSION_COOKIE_NAME.slice("__Host-".length);
}

export const env = data;
export type Env = typeof env;
