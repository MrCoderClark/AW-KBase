import { prisma } from "@kb/db";

/**
 * List tags. Optional `q` performs a case-insensitive prefix/infix match on
 * name/slug — suitable for a lightweight autocomplete (capped at `limit`).
 */
export async function listTags(opts: { q?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const where = opts.q
    ? {
        OR: [
          { name: { contains: opts.q, mode: "insensitive" as const } },
          { slug: { contains: opts.q.toLowerCase() } },
        ],
      }
    : undefined;

  const rows = await prisma.tag.findMany({
    where,
    orderBy: [{ name: "asc" }],
    take: limit,
    select: {
      id: true,
      slug: true,
      name: true,
      _count: { select: { articles: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    articleCount: r._count.articles,
  }));
}
