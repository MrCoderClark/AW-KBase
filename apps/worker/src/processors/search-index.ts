import { prisma } from "@kb/db";
import type { Job } from "bullmq";
import { ARTICLES_INDEX, meili } from "../infra/meilisearch.js";

/**
 * Build the Meilisearch document for an article. Kept in the worker because
 * indexing is the worker's responsibility — the API only enqueues jobs.
 */
async function buildArticleDoc(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      author: { select: { id: true, name: true } },
      category: { select: { slug: true, name: true } },
      tags: { include: { tag: { select: { slug: true, name: true } } } },
      currentVersion: { select: { contentMd: true } },
    },
  });

  if (!article || article.deletedAt) return null;

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    status: article.status,
    visibility: article.visibility,
    locale: article.locale,
    authorId: article.authorId,
    author: article.author,
    category: article.category,
    tags: article.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.name })),
    updatedAt: article.updatedAt.toISOString(),
    publishedAt: article.publishedAt?.toISOString() ?? null,
    // Index the markdown source — Meili tokenizes it well enough, and we
    // avoid re-rendering HTML which the API already sanitizes.
    contentMd: article.currentVersion?.contentMd ?? "",
  };
}

/**
 * BullMQ processor. Job name determines the action:
 *   - `reindex`: fetch from DB and upsert the Meili document
 *   - `remove`:  delete the Meili document by id
 */
export async function processSearchIndexJob(
  job: Job<{ articleId: string }>,
): Promise<{ action: string; articleId: string }> {
  const client = meili();
  if (!client) {
    // Soft-degrade: ack the job so it doesn't pile up retries.
    return { action: "skipped", articleId: job.data.articleId };
  }

  const index = client.index(ARTICLES_INDEX);
  const { articleId } = job.data;

  if (job.name === "remove") {
    await index.deleteDocument(articleId);
    return { action: "removed", articleId };
  }

  // Default: reindex
  const doc = await buildArticleDoc(articleId);
  if (!doc) {
    // Article was purged between enqueue and processing — treat as remove.
    await index.deleteDocument(articleId);
    return { action: "removed-missing", articleId };
  }
  await index.addDocuments([doc], { primaryKey: "id" });
  return { action: "indexed", articleId };
}
