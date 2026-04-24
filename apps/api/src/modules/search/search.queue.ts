import { searchIndexQueue } from "../../infra/queue.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

/**
 * Producer helpers for the search-index queue. Every article mutation calls
 * one of these; the worker consumes and actually talks to Meilisearch.
 *
 * When Meili isn't configured (dev without the container), we skip enqueue
 * silently — no point queueing jobs the worker will just drop.
 */

export async function enqueueReindex(articleId: string): Promise<void> {
  if (!env.MEILI_HOST) return;
  try {
    await searchIndexQueue.add("reindex", { articleId });
  } catch (err) {
    logger.warn({ err, articleId }, "queue.enqueueReindex.failed");
  }
}

export async function enqueueRemove(articleId: string): Promise<void> {
  if (!env.MEILI_HOST) return;
  try {
    await searchIndexQueue.add("remove", { articleId });
  } catch (err) {
    logger.warn({ err, articleId }, "queue.enqueueRemove.failed");
  }
}
