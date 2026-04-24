"use client";

import Link from "next/link";
import { FolderTree, ArrowRight } from "lucide-react";
import { useCategories } from "@/lib/categories";

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="grid size-8 place-items-center border border-border bg-muted/40">
          <FolderTree className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Categories
          </h1>
          <p className="text-xs text-muted-foreground">
            Browse the knowledge base by topic.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse border border-border bg-muted/30"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No categories yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="group flex flex-col justify-between gap-3 border border-border bg-background p-4 transition-colors hover:border-ring/40 hover:bg-muted/30"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {c.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {c.articleCount}
                  </span>
                </div>
                {c.description && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                    {c.description}
                  </p>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground group-hover:text-foreground">
                Browse
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
