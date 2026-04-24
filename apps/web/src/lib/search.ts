"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

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
  snippet: string | null;
};

export type SearchResponse = {
  hits: SearchHit[];
  total: number;
  query: string;
  took: number;
};

export type SearchVars = {
  q: string;
  category?: string;
  status?: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  limit?: number;
  offset?: number;
};

/**
 * Thin wrapper around `GET /v1/search`. Only fires when `q` has content so an
 * empty palette doesn't hit the server. Keeps an empty result set when the
 * query is blank so consumers can check `data?.hits.length`.
 */
export function useSearch(vars: SearchVars) {
  const trimmed = vars.q.trim();
  return useQuery({
    queryKey: ["search", { ...vars, q: trimmed }] as const,
    enabled: trimmed.length > 0,
    queryFn: () =>
      api.get<SearchResponse>("/v1/search", {
        searchParams: {
          q: trimmed,
          category: vars.category,
          status: vars.status,
          limit: vars.limit ?? 10,
          offset: vars.offset ?? 0,
        },
      }),
  });
}
