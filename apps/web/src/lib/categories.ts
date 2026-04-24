import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CategoryDto } from "@/lib/types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"] as const,
    queryFn: () => api.get<{ data: CategoryDto[] }>("/v1/categories"),
    staleTime: 5 * 60_000,
    select: (r) => r.data,
  });
}

export function useCategory(slug: string | undefined) {
  return useQuery({
    queryKey: ["categories", "detail", slug ?? ""] as const,
    queryFn: () => api.get<CategoryDto>(`/v1/categories/${slug}`),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}
