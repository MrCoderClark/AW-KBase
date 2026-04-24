"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Eye,
  ThumbsUp,
  Clock,
  ArrowUpRight,
  Filter,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/common/user-avatar";
import { useArticles } from "@/lib/articles";
import type { ArticleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusFilters: { key: ArticleStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PUBLISHED", label: "Published" },
  { key: "IN_REVIEW", label: "In review" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ARCHIVED", label: "Archived" },
];

const statusVariant = {
  PUBLISHED: "success",
  IN_REVIEW: "warning",
  DRAFT: "subtle",
  ARCHIVED: "outline",
} as const;

export default function ArticlesPage() {
  const [status, setStatus] = useState<ArticleStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error } = useArticles({
    q: q || undefined,
    status: status === "ALL" ? undefined : status,
    limit: 50,
  });

  const filtered = data?.data ?? [];

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-10">
      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-border pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Articles
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Loading…"
                : isError
                  ? "Failed to load"
                  : `${filtered.length} article${filtered.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <SlidersHorizontal className="size-3.5" />
              View
            </Button>
            <Button asChild>
              <Link href="/articles/new">
                <Plus className="size-3.5" />
                New article
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter articles…"
              className="pl-7"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="inline-flex items-center gap-0.5 border border-border bg-muted/30 p-0.5">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={cn(
                  "relative h-7 px-2.5 text-xs transition-colors",
                  status === f.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {status === f.key && (
                  <motion.span
                    layoutId="status-pill"
                    className="absolute inset-0 -z-10 bg-background shadow-[inset_0_0_0_1px_var(--border)]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                {f.label}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground">
            <Filter className="size-3.5" />
            More filters
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 border-b border-border">
        {/* header row */}
        <div className="grid grid-cols-[32px_1fr_140px_120px_110px_110px] items-center gap-4 border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <span />
          <span>Article</span>
          <span>Category</span>
          <span>Status</span>
          <span className="text-right">Engagement</span>
          <span className="text-right">Updated</span>
        </div>

        <ul>
          {filtered.map((a) => {
            const isSelected = selected.has(a.id);
            const helpRate =
              a.helpfulCount + a.notHelpfulCount > 0
                ? Math.round(
                  (a.helpfulCount / (a.helpfulCount + a.notHelpfulCount)) * 100,
                )
                : null;
            return (
              <li
                key={a.id}
                className={cn(
                  "group relative grid grid-cols-[32px_1fr_140px_120px_110px_110px] items-center gap-4 border-b border-border px-3 py-3 transition-colors hover:bg-muted/40",
                  isSelected && "bg-muted/60",
                )}
              >
                {isSelected && (
                  <span className="absolute left-0 top-0 h-full w-0.5 bg-primary" />
                )}
                <label className="flex h-4 w-4 items-center justify-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isSelected}
                    onChange={() => toggle(a.id)}
                  />
                  <span
                    className={cn(
                      "flex size-3.5 items-center justify-center border border-border bg-background transition-colors",
                      "peer-focus-visible:ring-1 peer-focus-visible:ring-ring",
                      isSelected && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {isSelected && <Check className="size-2.5" />}
                  </span>
                </label>
                <div className="min-w-0">
                  <Link
                    href={`/articles/${a.slug}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                      {a.title}
                    </span>
                    <ArrowUpRight className="size-3 shrink-0 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {a.author && (
                      <>
                        <UserAvatar name={a.author.name} size="sm" />
                        <span>{a.author.name}</span>
                      </>
                    )}
                    {a.tags.slice(0, 2).map((t) => (
                      <Badge key={t.slug} variant="outline" className="text-[9px]">
                        {t.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {a.category?.name ?? "—"}
                </span>
                <Badge variant={statusVariant[a.status]}>
                  {a.status.replace("_", " ").toLowerCase()}
                </Badge>
                <div className="flex items-center justify-end gap-3 text-[11px] tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="size-3" />
                    {a.helpfulCount.toLocaleString()}
                  </span>
                  {helpRate !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3" />
                      {helpRate}%
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  {relative(a.updatedAt)}
                </div>
              </li>
            );
          })}
        </ul>

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="grid size-10 place-items-center border border-border bg-muted/60 text-muted-foreground">
              <Search className="size-4" />
            </div>
            <div className="text-sm font-medium text-foreground">
              {isError ? "Couldn't load articles" : "No articles yet"}
            </div>
            <div className="max-w-sm text-xs text-muted-foreground">
              {isError
                ? (error as Error)?.message ?? "Please try again."
                : q || status !== "ALL"
                  ? "Try clearing filters or creating a new article."
                  : "Get started by creating your first article."}
            </div>
            {(q || status !== "ALL") && (
              <Button variant="outline" onClick={() => { setQ(""); setStatus("ALL"); }}>
                Reset filters
              </Button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center px-6 py-16 text-xs text-muted-foreground">
            Loading articles…
          </div>
        )}

        <div className="flex items-center justify-between px-3 py-3 text-[11px] text-muted-foreground">
          <span>
            Showing <span className="text-foreground">1–{filtered.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" disabled>
              Prev
            </Button>
            <Button variant="ghost" size="xs">
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 border border-border bg-background/95 px-2 py-1.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] backdrop-blur"
          >
            <span className="px-2 text-xs text-foreground">
              <span className="tabular-nums">{selected.size}</span> selected
            </span>
            <span className="h-5 w-px bg-border" />
            <Button variant="ghost" size="xs">Move to…</Button>
            <Button variant="ghost" size="xs">Archive</Button>
            <Button variant="destructive" size="xs">Delete</Button>
            <span className="h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function relative(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / (60 * 24))}d ago`;
}
