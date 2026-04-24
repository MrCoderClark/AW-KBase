import { Router } from "express";
import {
  ArticlesListQuery,
  CreateArticleBody,
  SubmitFeedbackBody,
  UpdateArticleBody,
} from "@kb/contracts/articles";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../middleware/validate.js";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/require-auth.js";
import {
  archiveArticle,
  createArticle,
  deleteArticle,
  getArticleBySlug,
  getArticleVersion,
  listArticles,
  listArticleVersions,
  publishArticle,
  purgeArticle,
  restoreArticle,
  submitFeedback,
  updateArticle,
} from "./articles.service.js";
import { z } from "zod";

export const articlesRouter = Router();

articlesRouter.get(
  "/",
  requireAuth,
  validate({ query: ArticlesListQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as import("@kb/contracts/articles").ArticlesListQuery;
    // The trash view exposes soft-deleted rows — gate it on article:delete so
    // regular readers can't enumerate deleted content.
    if (q.trashed && !req.user!.permissions.includes("article:delete")) {
      res.status(403).json({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: "You do not have permission to view trashed articles.",
      });
      return;
    }
    const result = await listArticles({
      q: q.q,
      category: q.category,
      status: q.status,
      cursor: q.cursor,
      limit: q.limit,
      trashed: q.trashed,
      viewerPermissions: new Set(req.user!.permissions),
    });
    res.json(result);
  }),
);

articlesRouter.get(
  "/:slug",
  requireAuth,
  asyncHandler(async (req, res) => {
    const article = await getArticleBySlug(
      req.params.slug!,
      new Set(req.user!.permissions),
    );
    res.json(article);
  }),
);

articlesRouter.post(
  "/",
  requireAuth,
  requirePermission("article:create"),
  validate({ body: CreateArticleBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as import("@kb/contracts/articles").CreateArticleBody;
    const article = await createArticle({
      title: body.title,
      summary: body.summary,
      contentMd: body.contentMd,
      categoryId: body.categoryId,
      tagSlugs: body.tagSlugs,
      visibility: body.visibility,
      status: body.status,
      locale: body.locale,
      authorId: req.user!.id,
    });
    res.status(201).json(article);
  }),
);

const IdParams = z.object({ id: z.string().uuid() });

articlesRouter.patch(
  "/:id",
  requireAuth,
  requirePermission("article:update"),
  validate({ params: IdParams, body: UpdateArticleBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as import("@kb/contracts/articles").UpdateArticleBody;
    const article = await updateArticle(req.params.id!, {
      ...body,
      editorId: req.user!.id,
    });
    res.json(article);
  }),
);

articlesRouter.post(
  "/:id/publish",
  requireAuth,
  requirePermission("article:publish"),
  validate({ params: IdParams }),
  asyncHandler(async (req, res) => {
    const article = await publishArticle(req.params.id!);
    res.json(article);
  }),
);

articlesRouter.post(
  "/:id/archive",
  requireAuth,
  requirePermission("article:archive"),
  validate({ params: IdParams }),
  asyncHandler(async (req, res) => {
    const article = await archiveArticle(req.params.id!);
    res.json(article);
  }),
);

articlesRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("article:delete"),
  validate({ params: IdParams }),
  asyncHandler(async (req, res) => {
    await deleteArticle(req.params.id!);
    res.status(204).end();
  }),
);

const VersionParams = IdParams.extend({
  versionNo: z.coerce.number().int().positive(),
});

articlesRouter.get(
  "/:id/versions",
  requireAuth,
  validate({ params: IdParams }),
  asyncHandler(async (req, res) => {
    const data = await listArticleVersions(req.params.id!);
    res.json({ data });
  }),
);

articlesRouter.get(
  "/:id/versions/:versionNo",
  requireAuth,
  validate({ params: VersionParams }),
  asyncHandler(async (req, res) => {
    const version = await getArticleVersion(
      req.params.id!,
      Number(req.params.versionNo),
    );
    res.json(version);
  }),
);

articlesRouter.post(
  "/:id/restore",
  requireAuth,
  requirePermission("article:delete"),
  validate({ params: IdParams }),
  asyncHandler(async (req, res) => {
    const article = await restoreArticle(req.params.id!);
    res.json(article);
  }),
);

articlesRouter.delete(
  "/:id/purge",
  requireAuth,
  requirePermission("article:delete"),
  validate({ params: IdParams }),
  asyncHandler(async (req, res) => {
    await purgeArticle(req.params.id!);
    res.status(204).end();
  }),
);

articlesRouter.post(
  "/:id/feedback",
  requireAuth,
  validate({ params: IdParams, body: SubmitFeedbackBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as import("@kb/contracts/articles").SubmitFeedbackBody;
    const result = await submitFeedback(req.params.id!, req.user!.id, body.vote);
    res.json(result);
  }),
);
