import { MeiliSearch } from "meilisearch";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Singleton Meilisearch client. If `MEILI_HOST` is not configured we return
 * `null` and all search-dependent features degrade gracefully (the search
 * endpoint returns 503, and mutations skip enqueueing reindex jobs).
 */
let client: MeiliSearch | null = null;

export function meili(): MeiliSearch | null {
  if (client) return client;
  if (!env.MEILI_HOST) {
    logger.warn("meili.disabled: MEILI_HOST not configured");
    return null;
  }
  client = new MeiliSearch({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });
  return client;
}

export const ARTICLES_INDEX = env.SEARCH_INDEX_NAME;
