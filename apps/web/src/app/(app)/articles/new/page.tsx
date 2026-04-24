"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { useCategories } from "@/lib/categories";
import { useCreateArticle } from "@/lib/articles";
import { ApiError } from "@/lib/api";
import type { CategoryDto } from "@/lib/types";
import { TagPicker } from "@/components/article/tag-picker";
import { MarkdownEditor } from "@/components/editor/markdown-editor";

export default function NewArticlePage() {
  const router = useRouter();
  const { data: categories = [] } = useCategories();
  const createArticle = useCreateArticle();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [categorySlug, setCategorySlug] = useState<string | undefined>(undefined);
  const [tagSlugs, setTagSlugs] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-select the first category once the list arrives.
  useEffect(() => {
    if (!categorySlug && categories.length > 0) {
      setCategorySlug(categories[0].slug);
    }
  }, [categories, categorySlug]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug],
  );

  const canSubmit =
    title.trim().length >= 3 && contentMd.trim().length > 0 && !createArticle.isPending;

  async function submit(status: "DRAFT" | "IN_REVIEW") {
    setSubmitError(null);
    if (!canSubmit) return;
    try {
      const article = await createArticle.mutateAsync({
        title: title.trim(),
        summary: summary.trim() || undefined,
        contentMd,
        categoryId: activeCategory?.id,
        tagSlugs,
        visibility: "INTERNAL",
        status,
        locale: "en",
      });
      router.push(`/articles/${article.slug}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.problem.detail || err.problem.title);
      } else {
        setSubmitError("Failed to save article.");
      }
    }
  }

  const saveState: "idle" | "saving" | "saved" = createArticle.isPending
    ? "saving"
    : createArticle.isSuccess
      ? "saved"
      : "idle";

  return (
    <div className="min-h-screen bg-background">
      {/* Editor topbar */}
      <div className="sticky top-[52px] z-20 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-6 py-2 backdrop-blur md:px-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild aria-label="Back">
            <Link href="/articles">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SaveStatus state={saveState} />
            <span className="text-muted-foreground/40">·</span>
            <CategoryPicker
              categories={categories}
              value={categorySlug}
              onChange={setCategorySlug}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {submitError && (
            <span className="text-[11px] text-destructive">{submitError}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!canSubmit}
            onClick={() => submit("DRAFT")}
          >
            Save draft
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={() => submit("IN_REVIEW")}
          >
            Submit for review
            <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">
              ⌘⇧P
            </Kbd>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[760px] px-6 py-12">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled article"
          className="w-full bg-transparent text-3xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none md:text-[34px]"
        />
        {/* Summary */}
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="Add a one-sentence summary your teammates can scan…"
          className="mt-3 w-full resize-none bg-transparent text-sm leading-relaxed text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />

        {/* Markdown editor with live preview */}
        <div className="mt-8">
          <MarkdownEditor
            value={contentMd}
            onChange={setContentMd}
            placeholder="# Start writing in Markdown…"
            minHeight={540}
          />
        </div>

        {/* Meta footer */}
        <div className="mt-16 space-y-4 border-t border-border pt-5">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Tags
            </label>
            <div className="mt-2">
              <TagPicker value={tagSlugs} onChange={setTagSlugs} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="subtle">draft</Badge>
            <span>·</span>
            <span>Version history available after first publish</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Check className="size-3 text-emerald-500" />
        Saved
      </span>
    );
  }
  return <span className="text-muted-foreground">Draft</span>;
}

function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: CategoryDto[];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = categories.find((c) => c.slug === value);

  if (categories.length === 0) {
    return (
      <span className="inline-flex h-6 items-center text-[11px] text-muted-foreground">
        Loading categories…
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-6 items-center gap-1 border border-border bg-background px-1.5 text-[11px] text-foreground hover:border-ring/40"
      >
        {active?.name ?? "Uncategorized"}
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-30 mt-1 w-[220px] border border-border bg-background p-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.3)]"
          >
            {categories.map((c) => (
              <li key={c.slug}>
                <button
                  onClick={() => { onChange(c.slug); setOpen(false); }}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
                >
                  <span className="text-foreground">{c.name}</span>
                  {c.slug === value && <Check className="size-3 text-primary" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

