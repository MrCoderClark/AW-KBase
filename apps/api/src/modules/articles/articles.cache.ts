import { cacheDel, cacheGetJSON, cacheSetJSON } from "../../infra/cache.js";
import { env } from "../../config/env.js";

/**
 * Cache keys for the article detail hot path.
 *
 * We only cache the **published-article view** — editors (who have
 * `article:update`) bypass the cache entirely so they always see the latest
 * draft/review state. This keeps cache invariants simple: one cached payload
 * per slug, valid only for status=PUBLISHED, readable by anyone.
 */

const PUB_KEY = (slug: string) => `article:slug:${slug}:pub`;
const SLUG_BY_ID_KEY = (id: string) => `article:id:${id}:slug`;

export async function cacheGetPublishedArticle<T>(
  slug: string,
): Promise<T | null> {
  return cacheGetJSON<T>(PUB_KEY(slug));
}

export async function cacheSetPublishedArticle(
  slug: string,
  id: string,
  payload: unknown,
): Promise<void> {
  const ttl = env.ARTICLE_CACHE_TTL_SEC;
  if (ttl <= 0) return;
  await Promise.all([
    cacheSetJSON(PUB_KEY(slug), payload, ttl),
    // Reverse lookup so invalidation-by-id can find the slug key.
    cacheSetJSON(SLUG_BY_ID_KEY(id), slug, ttl),
  ]);
}

/**
 * Drop any cached payload for an article. Safe to call with either slug, id,
 * or both — any mutation handler can invoke this without first looking up the
 * other identifier.
 */
export async function invalidateArticleCache(opts: {
  id?: string;
  slug?: string;
}): Promise<void> {
  const slugFromId = opts.id
    ? await cacheGetJSON<string>(SLUG_BY_ID_KEY(opts.id))
    : null;

  const keys: string[] = [];
  if (opts.slug) keys.push(PUB_KEY(opts.slug));
  if (slugFromId && slugFromId !== opts.slug) keys.push(PUB_KEY(slugFromId));
  if (opts.id) keys.push(SLUG_BY_ID_KEY(opts.id));

  if (keys.length) await cacheDel(...keys);
}
