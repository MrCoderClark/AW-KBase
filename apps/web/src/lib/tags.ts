import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TagDto } from "@/lib/types";

export function useTags(q?: string) {
  return useQuery({
    queryKey: ["tags", { q: q ?? "" }] as const,
    queryFn: () =>
      api.get<{ data: TagDto[] }>("/v1/tags", {
        searchParams: { q, limit: 50 },
      }),
    staleTime: 60_000,
    select: (r) => r.data,
  });
}
