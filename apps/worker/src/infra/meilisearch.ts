import { MeiliSearch } from "meilisearch";
import { env } from "../config/env.js";

let client: MeiliSearch | null = null;

export function meili(): MeiliSearch | null {
  if (client) return client;
  if (!env.MEILI_HOST) return null;
  client = new MeiliSearch({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });
  return client;
}

export const ARTICLES_INDEX = env.SEARCH_INDEX_NAME;

/**
 * Idempotent index bootstrap: ensure the articles index exists with the
 * correct settings (filterable + searchable attributes). Called once at
 * worker startup; safe to re-run.
 */
export async function ensureArticlesIndex(): Promise<void> {
  const client = meili();
  if (!client) return;

  // createIndex is idempotent — it rejects gracefully if already present.
  await client.createIndex(ARTICLES_INDEX, { primaryKey: "id" }).catch(() => {});

  const index = client.index(ARTICLES_INDEX);
  await index.updateSettings({
    searchableAttributes: ["title", "summary", "contentMd", "tags.name"],
    filterableAttributes: [
      "status",
      "visibility",
      "category.slug",
      "tags.slug",
      "locale",
      "authorId",
    ],
    sortableAttributes: ["updatedAt", "publishedAt"],
    displayedAttributes: [
      "id",
      "slug",
      "title",
      "summary",
      "status",
      "visibility",
      "category",
      "tags",
      "author",
      "updatedAt",
      "contentMd",
    ],
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ],
  });
}
