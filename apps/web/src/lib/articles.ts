import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ArticleDetail,
  ArticleListResponse,
  ArticleStatus,
  ArticleVisibility,
} from "@/lib/types";

export type ArticlesQueryVars = {
  q?: string;
  status?: ArticleStatus;
  category?: string;
  limit?: number;
  cursor?: string;
  trashed?: boolean;
};

const ARTICLES_KEY = (vars: ArticlesQueryVars) =>
  ["articles", "list", vars] as const;
const ARTICLE_KEY = (slug: string) => ["articles", "detail", slug] as const;

export function useArticles(vars: ArticlesQueryVars = {}) {
  return useQuery({
    queryKey: ARTICLES_KEY(vars),
    queryFn: () =>
      api.get<ArticleListResponse>("/v1/articles", {
        searchParams: {
          q: vars.q,
          status: vars.status,
          category: vars.category,
          limit: vars.limit ?? 20,
          cursor: vars.cursor,
          trashed: vars.trashed ? "true" : undefined,
        },
      }),
  });
}

export type ArticleVersionSummary = {
  id: string;
  versionNo: number;
  title: string;
  summary: string | null;
  isMajor: boolean;
  createdAt: string;
  editor: { id: string; name: string } | null;
};

export type ArticleVersionDetail = ArticleVersionSummary & {
  contentMd: string;
  contentHtml: string;
};

export function useArticleVersions(articleId: string | undefined) {
  return useQuery({
    queryKey: ["articles", "versions", articleId ?? ""] as const,
    queryFn: () =>
      api.get<{ data: ArticleVersionSummary[] }>(
        `/v1/articles/${articleId}/versions`,
      ),
    enabled: Boolean(articleId),
    select: (r) => r.data,
  });
}

export function useArticleVersion(
  articleId: string | undefined,
  versionNo: number | undefined,
) {
  return useQuery({
    queryKey: [
      "articles",
      "version",
      articleId ?? "",
      versionNo ?? 0,
    ] as const,
    queryFn: () =>
      api.get<ArticleVersionDetail>(
        `/v1/articles/${articleId}/versions/${versionNo}`,
      ),
    enabled: Boolean(articleId) && Boolean(versionNo),
    staleTime: 60_000,
  });
}

export function useArticle(slug: string | undefined) {
  return useQuery({
    queryKey: ARTICLE_KEY(slug ?? ""),
    queryFn: () => api.get<ArticleDetail>(`/v1/articles/${slug}`),
    enabled: Boolean(slug),
  });
}

export type CreateArticleVars = {
  title: string;
  summary?: string;
  contentMd: string;
  categoryId?: string;
  tagSlugs: string[];
  visibility: ArticleVisibility;
  status: "DRAFT" | "IN_REVIEW";
  locale?: string;
};

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateArticleVars) =>
      api.post<ArticleDetail>("/v1/articles", {
        locale: "en",
        ...body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles", "list"] });
    },
  });
}

export type FeedbackVote = "HELPFUL" | "NOT_HELPFUL";

export type UpdateArticleVars = {
  title?: string;
  summary?: string | null;
  contentMd?: string;
  categoryId?: string | null;
  tagSlugs?: string[];
  visibility?: ArticleVisibility;
  status?: "DRAFT" | "IN_REVIEW";
  isMajor?: boolean;
};

export function useUpdateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: UpdateArticleVars }) =>
      api.patch<ArticleDetail>(`/v1/articles/${vars.id}`, vars.patch),
    onSuccess: (article) => {
      qc.invalidateQueries({ queryKey: ["articles", "list"] });
      qc.setQueryData(ARTICLE_KEY(article.slug), article);
    },
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/v1/articles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles", "list"] });
      // We don't know the slug from id alone here; clear all detail caches
      // for safety — the next fetch will 404 anyway since it's soft-deleted.
      qc.invalidateQueries({ queryKey: ["articles", "detail"] });
    },
  });
}

export function useRestoreArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ArticleDetail>(`/v1/articles/${id}/restore`),
    onSuccess: (article) => {
      qc.invalidateQueries({ queryKey: ["articles", "list"] });
      qc.setQueryData(ARTICLE_KEY(article.slug), article);
    },
  });
}

export function usePurgeArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/v1/articles/${id}/purge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles", "list"] });
    },
  });
}

export function useArchiveArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ArticleDetail>(`/v1/articles/${id}/archive`),
    onSuccess: (article) => {
      qc.invalidateQueries({ queryKey: ["articles", "list"] });
      qc.setQueryData(ARTICLE_KEY(article.slug), article);
    },
  });
}

export function usePublishArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ArticleDetail>(`/v1/articles/${id}/publish`),
    onSuccess: (article) => {
      qc.invalidateQueries({ queryKey: ["articles", "list"] });
      qc.setQueryData(["articles", "detail", article.slug], article);
    },
  });
}

export function useSubmitFeedback(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; vote: FeedbackVote }) =>
      api.post<{
        helpfulCount: number;
        notHelpfulCount: number;
        vote: FeedbackVote;
      }>(`/v1/articles/${vars.id}/feedback`, { vote: vars.vote }),
    onSuccess: (data) => {
      // Patch the cached detail so the counts update without a refetch.
      qc.setQueryData<ArticleDetail | undefined>(
        ["articles", "detail", slug],
        (prev) =>
          prev
            ? {
              ...prev,
              helpfulCount: data.helpfulCount,
              notHelpfulCount: data.notHelpfulCount,
            }
            : prev,
      );
    },
  });
}
