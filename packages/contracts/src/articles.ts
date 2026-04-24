import { z } from "zod";
import { PageInfoSchema, SlugSchema } from "./common";

export const ArticleStatus = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
]);
export type ArticleStatus = z.infer<typeof ArticleStatus>;

export const ArticleVisibility = z.enum([
  "INTERNAL",
  "RESTRICTED",
  "PUBLIC",
]);
export type ArticleVisibility = z.infer<typeof ArticleVisibility>;

export const CreateArticleBody = z.object({
  title: z.string().min(3).max(200).trim(),
  summary: z.string().max(500).trim().optional(),
  contentMd: z.string().min(1).max(500_000),
  categoryId: z.string().uuid().optional(),
  tagSlugs: z.array(SlugSchema).max(20).default([]),
  visibility: ArticleVisibility.default("INTERNAL"),
  status: z.enum(["DRAFT", "IN_REVIEW"]).default("DRAFT"),
  locale: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .default("en"),
});
export type CreateArticleBody = z.infer<typeof CreateArticleBody>;

export const UpdateArticleBody = z
  .object({
    title: z.string().min(3).max(200).trim().optional(),
    summary: z.string().max(500).trim().nullable().optional(),
    contentMd: z.string().min(1).max(500_000).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    tagSlugs: z.array(SlugSchema).max(20).optional(),
    visibility: ArticleVisibility.optional(),
    status: z.enum(["DRAFT", "IN_REVIEW"]).optional(),
    isMajor: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateArticleBody = z.infer<typeof UpdateArticleBody>;

export const ArticlesListQuery = z.object({
  q: z.string().trim().optional(),
  category: z.string().optional(),
  status: ArticleStatus.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // When true, only return soft-deleted articles (trash view). Defaults to
  // excluding deleted rows. Requires article:delete on the server.
  trashed: z.coerce.boolean().optional(),
});
export type ArticlesListQuery = z.infer<typeof ArticlesListQuery>;

export const ArticleListItem = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  status: ArticleStatus,
  visibility: ArticleVisibility,
  author: z.object({ id: z.string().uuid(), name: z.string() }),
  category: z
    .object({ id: z.string().uuid(), name: z.string(), slug: z.string() })
    .nullable(),
  tags: z.array(z.object({ slug: z.string(), name: z.string() })),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  helpfulCount: z.number().int(),
  notHelpfulCount: z.number().int(),
});
export type ArticleListItem = z.infer<typeof ArticleListItem>;

export const ArticlesListResponse = z.object({
  data: z.array(ArticleListItem),
  pageInfo: PageInfoSchema,
});
export type ArticlesListResponse = z.infer<typeof ArticlesListResponse>;

export const FeedbackVote = z.enum(["HELPFUL", "NOT_HELPFUL"]);
export type FeedbackVote = z.infer<typeof FeedbackVote>;

export const SubmitFeedbackBody = z.object({
  vote: FeedbackVote,
});
export type SubmitFeedbackBody = z.infer<typeof SubmitFeedbackBody>;

export const SubmitFeedbackResponse = z.object({
  helpfulCount: z.number().int(),
  notHelpfulCount: z.number().int(),
  vote: FeedbackVote,
});
export type SubmitFeedbackResponse = z.infer<typeof SubmitFeedbackResponse>;

export const ArticleVersionSummary = z.object({
  id: z.string().uuid(),
  versionNo: z.number().int(),
  title: z.string(),
  summary: z.string().nullable(),
  isMajor: z.boolean(),
  createdAt: z.string(),
  editor: z
    .object({ id: z.string().uuid(), name: z.string() })
    .nullable(),
});
export type ArticleVersionSummary = z.infer<typeof ArticleVersionSummary>;

export const ArticleVersionDetail = ArticleVersionSummary.extend({
  contentMd: z.string(),
  contentHtml: z.string(),
});
export type ArticleVersionDetail = z.infer<typeof ArticleVersionDetail>;

export const ArticleDto = ArticleListItem.extend({
  locale: z.string(),
  categoryId: z.string().uuid().nullable(),
  currentVersion: z
    .object({
      id: z.string().uuid(),
      versionNo: z.number().int(),
      createdAt: z.string(),
    })
    .nullable(),
  createdAt: z.string(),
});
export type ArticleDto = z.infer<typeof ArticleDto>;
