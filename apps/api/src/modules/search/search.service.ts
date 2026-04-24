import type { SearchHit, SearchQuery, SearchResponse } from "@kb/contracts/search";
import { ARTICLES_INDEX, meili } from "../../infra/meilisearch.js";
import { AppError } from "../../errors/app-error.js";

/**
 * Search articles via Meilisearch.
 *
 * Permission model: Meili holds documents for every article regardless of
 * status/visibility. At query time we apply a filter derived from the
 * viewer's permissions so drafts/in-review only surface for editors, and
 * RESTRICTED articles are hidden from non-editors too.
 */

type MeiliHit = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: SearchHit["status"];
  visibility: SearchHit["visibility"];
  category: { slug: string; name: string } | null;
  tags: { slug: string; name: string }[];
  author: { id: string; name: string } | null;
  updatedAt: string;
  _formatted?: {
    title?: string;
    summary?: string | null;
    contentMd?: string;
  };
};

export async function searchArticles(
  q: SearchQuery,
  viewerPermissions: Set<string>,
): Promise<SearchResponse> {
  const client = meili();
  if (!client) {
    throw new AppError(
      "Search is not configured on this deployment.",
      503,
      "search_unavailable",
    );
  }

  const isEditor = viewerPermissions.has("article:update");

  // Permission-aware filter. Non-editors only see PUBLISHED non-RESTRICTED.
  const filter: string[] = [];
  if (!isEditor) {
    filter.push('status = "PUBLISHED"');
    filter.push('visibility IN ["PUBLIC", "INTERNAL"]');
  } else if (q.status) {
    filter.push(`status = "${q.status}"`);
  }
  if (q.category) filter.push(`category.slug = "${escapeFilter(q.category)}"`);

  const index = client.index(ARTICLES_INDEX);
  const started = Date.now();

  const res = await index.search<MeiliHit>(q.q, {
    limit: q.limit,
    offset: q.offset,
    filter: filter.length ? filter : undefined,
    attributesToHighlight: ["title", "summary", "contentMd"],
    attributesToCrop: ["contentMd"],
    cropLength: 40,
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
  });

  const hits: SearchHit[] = res.hits.map((h) => ({
    id: h.id,
    slug: h.slug,
    title: h.title,
    summary: h.summary,
    status: h.status,
    visibility: h.visibility,
    category: h.category,
    tags: h.tags,
    author: h.author,
    updatedAt: h.updatedAt,
    snippet: h._formatted?.contentMd ?? h._formatted?.summary ?? null,
  }));

  return {
    hits,
    total: res.estimatedTotalHits ?? res.hits.length,
    query: q.q,
    took: Date.now() - started,
  };
}

/** Meili filter grammar is picky; escape the minimum we need for slugs. */
function escapeFilter(value: string): string {
  return value.replace(/"/g, '\\"');
}
