import { z } from "zod";

/**
 * Request + response shapes for the Meilisearch-backed `/v1/search` endpoint.
 * Kept separate from the articles list contract because search has its own
 * ranking semantics (relevance-ordered hits with snippets/highlights) and
 * will grow to cover other entity types (categories, comments) later.
 */

export const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  category: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

/** One article hit in the search response. Mirrors the Meili document. */
export type SearchHit = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "INTERNAL" | "RESTRICTED";
  category: { slug: string; name: string } | null;
  tags: { slug: string; name: string }[];
  author: { id: string; name: string } | null;
  updatedAt: string;
  /** Matched, highlighted snippet. Server wraps matches in `<mark>…</mark>`. */
  snippet: string | null;
};

export type SearchResponse = {
  hits: SearchHit[];
  total: number;
  query: string;
  took: number;
};
