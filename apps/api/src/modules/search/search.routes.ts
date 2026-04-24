import { Router } from "express";
import { prisma } from "@kb/db";
import { SearchQuery } from "@kb/contracts/search";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middleware/validate.js";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/require-auth.js";
import { searchArticles } from "./search.service.js";
import { enqueueReindex } from "./search.queue.js";

export const searchRouter = Router();

/**
 * GET /v1/search?q=&category=&status=&limit=&offset=
 *
 * Full-text search over articles, backed by Meilisearch. Permission-aware:
 * non-editors only see PUBLISHED + non-RESTRICTED articles. Returns
 * snippets with matched terms wrapped in `<mark>` tags for highlighting.
 */
searchRouter.get(
  "/",
  requireAuth,
  validate({ query: SearchQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as import("@kb/contracts/search").SearchQuery;
    const result = await searchArticles(
      q,
      new Set(req.user!.permissions),
    );
    res.json(result);
  }),
);

/**
 * POST /v1/search/reindex — enqueue a reindex job for every non-deleted
 * article. Use this once after standing up Meilisearch for the first time
 * to populate the index with existing content, or after changing the index
 * settings. Idempotent: jobs are deduped by article id via `jobId`.
 */
searchRouter.post(
  "/reindex",
  requireAuth,
  requirePermission("article:publish"),
  asyncHandler(async (_req, res) => {
    const ids = await prisma.article.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    await Promise.all(ids.map((a) => enqueueReindex(a.id)));
    res.json({ enqueued: ids.length });
  }),
);
