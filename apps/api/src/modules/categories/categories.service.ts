import { prisma } from "@kb/db";
import { NotFoundError } from "../../errors/app-error.js";

/**
 * Return all categories ordered by name. Non-hierarchical for now — if we
 * introduce parent/child relationships we can layer that on via `parentId`.
 */
export async function listCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { articles: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    articleCount: r._count.articles,
  }));
}

export async function getCategoryBySlug(slug: string) {
  const row = await prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { articles: true } },
    },
  });
  if (!row) throw new NotFoundError("Category not found");
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    articleCount: row._count.articles,
  };
}
