/** Shared types mirroring the API responses. */

export type ArticleStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
export type ArticleVisibility = "INTERNAL" | "RESTRICTED" | "PUBLIC";

export type CategoryDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  articleCount: number;
};

export type TagDto = {
  id: string;
  slug: string;
  name: string;
  articleCount: number;
};

export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roles: string[];
  permissions: string[];
};

export type MeResponse = {
  user: AuthUserDto;
  session: { expiresAt: string };
};

export type ArticleListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: ArticleStatus;
  visibility: ArticleVisibility;
  author: { id: string; name: string } | null;
  category: { id: string; name: string; slug: string } | null;
  tags: { slug: string; name: string }[];
  updatedAt: string;
  publishedAt: string | null;
  helpfulCount: number;
  notHelpfulCount: number;
};

export type ArticleListResponse = {
  data: ArticleListItem[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
};

export type ArticleDetail = ArticleListItem & {
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
