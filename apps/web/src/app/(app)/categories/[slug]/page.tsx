"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCategory } from "@/lib/categories";
import { useArticles } from "@/lib/articles";
import { ApiError } from "@/lib/api";

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const category = useCategory(slug);
  const articles = useArticles({ category: slug, limit: 30 });

  if (category.error instanceof ApiError && category.error.status === 404) {
    notFound();
  }

  if (category.isLoading || !category.data) {
    return (
      <div className="mx-auto max-w-[1000px] px-6 py-10 md:px-10">
        <div className="h-5 w-24 bg-muted animate-pulse" />
        <div className="mt-8 h-8 w-[40%] bg-muted animate-pulse" />
        <div className="mt-10 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  const c = category.data;
  const rows = articles.data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-10 md:px-10">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/categories">
          <ArrowLeft className="size-3.5" />
          All categories
        </Link>
      </Button>

      <header className="mt-6 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {c.name}
        </h1>
        {c.description && (
          <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
            {c.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{c.articleCount}</span>
          <span>article{c.articleCount === 1 ? "" : "s"}</span>
        </div>
      </header>

      {articles.isLoading ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No articles in this category yet.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                href={`/articles/${a.slug}`}
                className="group flex items-start gap-3 border-b border-border px-1 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="mt-0.5 grid size-7 shrink-0 place-items-center border border-border bg-muted/40">
                  <FileText className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                      {a.title}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.summary && (
                    <span className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed text-muted-foreground">
                      {a.summary}
                    </span>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/80">
                    <Clock className="size-2.5" />
                    <span>
                      Updated {new Date(a.updatedAt).toLocaleDateString()}
                    </span>
                    {a.author?.name && (
                      <>
                        <span>·</span>
                        <span>by {a.author.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PUBLISHED") return null; // don't clutter the common case
  const variant =
    status === "DRAFT"
      ? "subtle"
      : status === "IN_REVIEW"
        ? "warning"
        : "secondary";
  return (
    <Badge variant={variant} className="text-[9px]">
      {status.toLowerCase().replace("_", " ")}
    </Badge>
  );
}
