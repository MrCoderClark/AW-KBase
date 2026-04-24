import { prisma, type ArticleStatus, type ArticleVisibility } from "@kb/db";
import type { Prisma } from "@prisma/client";
import { NotFoundError } from "../../errors/app-error.js";
import { renderMarkdownSafe } from "../../utils/markdown.js";
import { slugify, uniqueSlug } from "../../utils/slug.js";
import {
  cacheGetPublishedArticle,
  cacheSetPublishedArticle,
  invalidateArticleCache,
} from "./articles.cache.js";
import {
  enqueueRemove,
  enqueueReindex,
} from "../search/search.queue.js";

export type ListFilters = {
  q?: string;
  category?: string;
  status?: ArticleStatus;
  cursor?: string;
  limit: number;
  trashed?: boolean;
  viewerPermissions: Set<string>;
};

const LIST_INCLUDE = {
  author: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: { select: { slug: true, name: true } } } },
} as const;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  currentVersion: {
    select: {
      id: true,
      versionNo: true,
      contentHtml: true,
      contentMd: true,
      createdAt: true,
    },
  },
} as const;

function visibleStatusWhere(
  viewerPermissions: Set<string>,
): Prisma.ArticleWhereInput {
  // Everyone authenticated sees PUBLISHED. Editors/admins may see drafts.
  if (viewerPermissions.has("article:update")) return {};
  return { status: "PUBLISHED" };
}

function toListItem(
  a: Prisma.ArticleGetPayload<{ include: typeof LIST_INCLUDE }>,
) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    status: a.status,
    visibility: a.visibility,
    author: a.author,
    category: a.category,
    tags: a.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.name })),
    updatedAt: a.updatedAt.toISOString(),
    publishedAt: a.publishedAt?.toISOString() ?? null,
    helpfulCount: a.helpfulCount,
    notHelpfulCount: a.notHelpfulCount,
  };
}

export async function listArticles(f: ListFilters) {
  // Trash view flips the `deletedAt` filter and skips the PUBLISHED-only
  // restriction — only callers with article:delete should be able to reach it
  // (the route enforces this).
  const deletedClause: Prisma.ArticleWhereInput = f.trashed
    ? { deletedAt: { not: null } }
    : { deletedAt: null };
  const visibleClause = f.trashed ? {} : visibleStatusWhere(f.viewerPermissions);

  const where: Prisma.ArticleWhereInput = {
    ...deletedClause,
    ...visibleClause,
    ...(f.status ? { status: f.status } : {}),
    ...(f.category ? { category: { slug: f.category } } : {}),
    ...(f.q
      ? {
        OR: [
          { title: { contains: f.q, mode: "insensitive" } },
          { summary: { contains: f.q, mode: "insensitive" } },
        ],
      }
      : {}),
  };

  const rows = await prisma.article.findMany({
    where,
    include: LIST_INCLUDE,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: f.limit + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
  });

  const hasNextPage = rows.length > f.limit;
  const page = hasNextPage ? rows.slice(0, f.limit) : rows;
  const nextCursor = hasNextPage ? (page.at(-1)?.id ?? null) : null;

  return {
    data: page.map(toListItem),
    pageInfo: { nextCursor, hasNextPage },
  };
}

export async function getArticleBySlug(
  slug: string,
  viewerPermissions: Set<string>,
) {
  // Editors bypass the cache so they always see the latest draft/review state.
  // Regular viewers read the cached PUBLISHED payload when available, which
  // offloads the hot article-detail path from Postgres.
  const isEditor = viewerPermissions.has("article:update");

  if (!isEditor) {
    const cached = await cacheGetPublishedArticle<ArticleDetailDto>(slug);
    if (cached) return cached;
  }

  const article = await prisma.article.findFirst({
    where: {
      slug,
      deletedAt: null,
      ...visibleStatusWhere(viewerPermissions),
    },
    include: DETAIL_INCLUDE,
  });
  if (!article) throw new NotFoundError("Article not found");

  const dto: ArticleDetailDto = {
    ...toListItem(article),
    locale: article.locale,
    categoryId: article.categoryId,
    createdAt: article.createdAt.toISOString(),
    currentVersion: article.currentVersion
      ? {
        id: article.currentVersion.id,
        versionNo: article.currentVersion.versionNo,
        contentHtml: article.currentVersion.contentHtml,
        contentMd: article.currentVersion.contentMd,
        createdAt: article.currentVersion.createdAt.toISOString(),
      }
      : null,
  };

  // Only populate the cache for the public, stable PUBLISHED view — drafts
  // and in-review articles are editor-only and shouldn't be cached under a
  // key readable by non-editors.
  if (!isEditor && article.status === "PUBLISHED") {
    void cacheSetPublishedArticle(slug, article.id, dto);
  }

  return dto;
}

type ArticleDetailDto = ReturnType<typeof toListItem> & {
  locale: string;
  categoryId: string | null;
  createdAt: string;
  currentVersion: {
    id: string;
    versionNo: number;
    contentHtml: string;
    contentMd: string;
    createdAt: string;
  } | null;
};

export type CreateArticleInput = {
  title: string;
  summary?: string;
  contentMd: string;
  categoryId?: string;
  tagSlugs: string[];
  visibility: ArticleVisibility;
  status: "DRAFT" | "IN_REVIEW";
  locale: string;
  authorId: string;
};

export async function createArticle(input: CreateArticleInput) {
  const contentHtml = await renderMarkdownSafe(input.contentMd);
  const slug = await uniqueSlug(input.title, async (candidate) => {
    const existing = await prisma.article.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return existing !== null;
  });

  // Ensure tags exist (create missing), then collect their IDs.
  const tagIds: string[] = [];
  for (const s of input.tagSlugs) {
    const name = s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const tag = await prisma.tag.upsert({
      where: { slug: slugify(s) },
      update: {},
      create: { slug: slugify(s), name },
      select: { id: true },
    });
    tagIds.push(tag.id);
  }

  const created = await prisma.$transaction(async (tx) => {
    const article = await tx.article.create({
      data: {
        slug,
        title: input.title,
        summary: input.summary ?? null,
        status: input.status,
        visibility: input.visibility,
        locale: input.locale,
        authorId: input.authorId,
        categoryId: input.categoryId ?? null,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });

    const version = await tx.articleVersion.create({
      data: {
        articleId: article.id,
        versionNo: 1,
        title: input.title,
        summary: input.summary ?? null,
        contentMd: input.contentMd,
        contentHtml,
        editorId: input.authorId,
        isMajor: true,
      },
    });

    await tx.article.update({
      where: { id: article.id },
      data: { currentVersionId: version.id },
    });

    return article.id;
  });

  await enqueueReindex(created);
  return getArticleBySlug(
    slug,
    new Set(["article:read", "article:update"]), // bypass status filter
  );
}

export type UpdateArticleInput = {
  title?: string;
  summary?: string | null;
  contentMd?: string;
  categoryId?: string | null;
  tagSlugs?: string[];
  visibility?: ArticleVisibility;
  status?: "DRAFT" | "IN_REVIEW";
  isMajor?: boolean;
  editorId: string;
};

/**
 * Update an article. If `contentMd` changes we create a new ArticleVersion,
 * bump `versionNo`, re-render the sanitized HTML, and point `currentVersionId`
 * at the new version — keeping an immutable audit trail of every revision.
 */
export async function updateArticle(id: string, input: UpdateArticleInput) {
  const existing = await prisma.article.findFirst({
    where: { id, deletedAt: null },
    include: {
      currentVersion: { select: { versionNo: true, contentMd: true } },
    },
  });
  if (!existing) throw new NotFoundError("Article not found");

  const contentChanged =
    input.contentMd !== undefined &&
    input.contentMd !== existing.currentVersion?.contentMd;

  // Ensure tags exist if supplied.
  let nextTagIds: string[] | undefined;
  if (input.tagSlugs) {
    nextTagIds = [];
    for (const s of input.tagSlugs) {
      const slug = slugify(s);
      const name = s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const tag = await prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { slug, name },
        select: { id: true },
      });
      nextTagIds.push(tag.id);
    }
  }

  const contentHtml = contentChanged
    ? await renderMarkdownSafe(input.contentMd!)
    : null;

  await prisma.$transaction(async (tx) => {
    const articleData: Prisma.ArticleUpdateInput = {};
    if (input.title !== undefined) articleData.title = input.title;
    if (input.summary !== undefined) articleData.summary = input.summary;
    if (input.visibility !== undefined) articleData.visibility = input.visibility;
    if (input.status !== undefined) articleData.status = input.status;
    if (input.categoryId !== undefined) {
      articleData.category =
        input.categoryId === null
          ? { disconnect: true }
          : { connect: { id: input.categoryId } };
    }

    if (contentChanged) {
      const nextVersionNo = (existing.currentVersion?.versionNo ?? 0) + 1;
      const version = await tx.articleVersion.create({
        data: {
          articleId: id,
          versionNo: nextVersionNo,
          title: input.title ?? existing.title,
          summary:
            input.summary !== undefined ? input.summary : existing.summary,
          contentMd: input.contentMd!,
          contentHtml: contentHtml!,
          editorId: input.editorId,
          isMajor: input.isMajor ?? false,
        },
        select: { id: true },
      });
      articleData.currentVersion = { connect: { id: version.id } };
    }

    if (Object.keys(articleData).length > 0) {
      await tx.article.update({ where: { id }, data: articleData });
    }

    if (nextTagIds) {
      await tx.articleTag.deleteMany({ where: { articleId: id } });
      if (nextTagIds.length > 0) {
        await tx.articleTag.createMany({
          data: nextTagIds.map((tagId) => ({ articleId: id, tagId })),
        });
      }
    }
  });

  // Re-fetch by id → slug to return fresh detail.
  const fresh = await prisma.article.findUniqueOrThrow({
    where: { id },
    select: { slug: true },
  });
  await invalidateArticleCache({ id, slug: fresh.slug });
  await enqueueReindex(id);
  return getArticleBySlug(
    fresh.slug,
    new Set(["article:read", "article:update"]),
  );
}

/**
 * List all revisions of an article, newest first. Returns summary fields only
 * — full content is fetched on-demand via `getArticleVersion` to keep the
 * list payload small even for articles with many edits.
 */
export async function listArticleVersions(articleId: string) {
  const article = await prisma.article.findFirst({
    where: { id: articleId, deletedAt: null },
    select: { id: true },
  });
  if (!article) throw new NotFoundError("Article not found");

  const rows = await prisma.articleVersion.findMany({
    where: { articleId },
    orderBy: { versionNo: "desc" },
    select: {
      id: true,
      versionNo: true,
      title: true,
      summary: true,
      isMajor: true,
      createdAt: true,
      editor: { select: { id: true, name: true } },
    },
  });

  return rows.map((v) => ({
    id: v.id,
    versionNo: v.versionNo,
    title: v.title,
    summary: v.summary,
    isMajor: v.isMajor,
    createdAt: v.createdAt.toISOString(),
    editor: v.editor,
  }));
}

/**
 * Fetch a single historical revision by its version number. Returns the full
 * sanitized HTML so the UI can render it without re-processing the markdown.
 */
export async function getArticleVersion(articleId: string, versionNo: number) {
  const article = await prisma.article.findFirst({
    where: { id: articleId, deletedAt: null },
    select: { id: true },
  });
  if (!article) throw new NotFoundError("Article not found");

  const version = await prisma.articleVersion.findFirst({
    where: { articleId, versionNo },
    select: {
      id: true,
      versionNo: true,
      title: true,
      summary: true,
      isMajor: true,
      contentMd: true,
      contentHtml: true,
      createdAt: true,
      editor: { select: { id: true, name: true } },
    },
  });
  if (!version) throw new NotFoundError("Version not found");

  return {
    id: version.id,
    versionNo: version.versionNo,
    title: version.title,
    summary: version.summary,
    isMajor: version.isMajor,
    contentMd: version.contentMd,
    contentHtml: version.contentHtml,
    createdAt: version.createdAt.toISOString(),
    editor: version.editor,
  };
}

/**
 * Soft-delete an article: stamps `deletedAt` so it disappears from every
 * listing/detail query (which all filter on `deletedAt: null`). The row and
 * its versions stay in the database for audit and potential restore.
 */
export async function deleteArticle(id: string) {
  const existing = await prisma.article.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Article not found");

  await prisma.article.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await invalidateArticleCache({ id });
  await enqueueRemove(id);
}

/**
 * Restore a soft-deleted article by clearing `deletedAt`. Only operates on
 * rows that are currently trashed — returns 404 otherwise so restore can't be
 * used to "undelete" something that was never deleted.
 */
export async function restoreArticle(id: string) {
  const existing = await prisma.article.findFirst({
    where: { id, deletedAt: { not: null } },
    select: { id: true, slug: true },
  });
  if (!existing) throw new NotFoundError("Trashed article not found");

  await prisma.article.update({
    where: { id },
    data: { deletedAt: null },
  });
  await invalidateArticleCache({ id, slug: existing.slug });
  await enqueueReindex(id);

  return getArticleBySlug(
    existing.slug,
    new Set(["article:read", "article:update"]),
  );
}

/**
 * Permanently delete a soft-deleted article, cascading to its versions, tags,
 * feedback, etc. (handled by `onDelete: Cascade` relations in the schema).
 * Only operates on already-trashed rows — enforce a two-step flow: trash
 * first, purge second. No going back from here.
 */
export async function purgeArticle(id: string) {
  const existing = await prisma.article.findFirst({
    where: { id, deletedAt: { not: null } },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Trashed article not found");

  // Break the article -> currentVersion FK before deleting versions so Prisma
  // doesn't complain about a dangling reference.
  await prisma.$transaction(async (tx) => {
    await tx.article.update({
      where: { id },
      data: { currentVersionId: null },
    });
    await tx.article.delete({ where: { id } });
  });
  await invalidateArticleCache({ id });
  await enqueueRemove(id);
}

/**
 * Archive an article: set status = ARCHIVED and stamp archivedAt.
 * Idempotent — archiving an already-archived article is a no-op.
 */
export async function archiveArticle(id: string) {
  const existing = await prisma.article.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true, status: true, archivedAt: true },
  });
  if (!existing) throw new NotFoundError("Article not found");

  if (existing.status !== "ARCHIVED") {
    await prisma.article.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        archivedAt: existing.archivedAt ?? new Date(),
      },
    });
    await invalidateArticleCache({ id, slug: existing.slug });
    await enqueueReindex(id);
  }

  return getArticleBySlug(
    existing.slug,
    new Set(["article:read", "article:update"]),
  );
}

/**
 * Publish an article: set status = PUBLISHED and stamp publishedAt (only once).
 * Idempotent — publishing an already-published article is a no-op.
 */
export async function publishArticle(id: string) {
  const existing = await prisma.article.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true, status: true, publishedAt: true },
  });
  if (!existing) throw new NotFoundError("Article not found");

  if (existing.status !== "PUBLISHED") {
    await prisma.article.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: existing.publishedAt ?? new Date(),
      },
    });
    await invalidateArticleCache({ id, slug: existing.slug });
    await enqueueReindex(id);
  }

  return getArticleBySlug(
    existing.slug,
    new Set(["article:read", "article:update"]),
  );
}

/**
 * Submit/toggle a feedback vote for an article. Upserts by (articleId, userId)
 * so each user only counts once; flipping the vote decrements the old counter
 * and increments the new one atomically.
 */
export async function submitFeedback(
  articleId: string,
  userId: string,
  vote: "HELPFUL" | "NOT_HELPFUL",
) {
  const article = await prisma.article.findFirst({
    where: { id: articleId, deletedAt: null },
    select: { id: true },
  });
  if (!article) throw new NotFoundError("Article not found");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.feedback.findUnique({
      where: { articleId_userId: { articleId, userId } },
      select: { id: true, vote: true },
    });

    if (existing && existing.vote === vote) {
      return; // no-op — already voted this way
    }

    if (existing) {
      await tx.feedback.update({
        where: { id: existing.id },
        data: { vote },
      });
      // Flip counters: decrement previous, increment new.
      await tx.article.update({
        where: { id: articleId },
        data:
          vote === "HELPFUL"
            ? {
              helpfulCount: { increment: 1 },
              notHelpfulCount: { decrement: 1 },
            }
            : {
              helpfulCount: { decrement: 1 },
              notHelpfulCount: { increment: 1 },
            },
      });
    } else {
      await tx.feedback.create({
        data: { articleId, userId, vote },
      });
      await tx.article.update({
        where: { id: articleId },
        data:
          vote === "HELPFUL"
            ? { helpfulCount: { increment: 1 } }
            : { notHelpfulCount: { increment: 1 } },
      });
    }
  });

  const updated = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    select: { helpfulCount: true, notHelpfulCount: true },
  });
  // Counters are part of the cached payload — invalidate so the next read
  // reflects the new vote instead of stale numbers.
  await invalidateArticleCache({ id: articleId });
  return {
    helpfulCount: updated.helpfulCount,
    notHelpfulCount: updated.notHelpfulCount,
    vote,
  };
}
