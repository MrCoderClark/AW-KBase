"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useArticle, useUpdateArticle } from "@/lib/articles";
import { useCategories } from "@/lib/categories";
import { ApiError } from "@/lib/api";
import { TagPicker } from "@/components/article/tag-picker";
import { MarkdownEditor } from "@/components/editor/markdown-editor";

export default function EditArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: article, isLoading, error } = useArticle(slug);
  const { data: categories = [] } = useCategories();
  const update = useUpdateArticle();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [categoryId, setCategoryId] = useState<string | "">("");
  const [tagSlugs, setTagSlugs] = useState<string[]>([]);
  const [isMajor, setIsMajor] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hydrate form once the article arrives.
  useEffect(() => {
    if (!article) return;
    setTitle(article.title);
    setSummary(article.summary ?? "");
    setContentMd(article.currentVersion?.contentMd ?? "");
    setCategoryId(article.categoryId ?? "");
    setTagSlugs(article.tags.map((t) => t.slug));
  }, [article]);

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="mx-auto max-w-[760px] px-6 py-12 text-sm text-muted-foreground">
        Article not found.
      </div>
    );
  }

  if (isLoading || !article) {
    return (
      <div className="mx-auto max-w-[760px] px-6 py-12">
        <div className="h-5 w-24 bg-muted animate-pulse" />
        <div className="mt-8 h-8 w-[60%] bg-muted animate-pulse" />
        <div className="mt-10 h-[50vh] bg-muted/60 animate-pulse" />
      </div>
    );
  }

  const originalTagSlugs = article.tags.map((t) => t.slug);
  const tagsChanged =
    tagSlugs.length !== originalTagSlugs.length ||
    tagSlugs.some((s, i) => s !== originalTagSlugs[i]);

  const dirty =
    title !== article.title ||
    summary !== (article.summary ?? "") ||
    contentMd !== (article.currentVersion?.contentMd ?? "") ||
    categoryId !== (article.categoryId ?? "") ||
    tagsChanged;

  const canSubmit = title.trim().length >= 3 && contentMd.trim().length > 0;

  async function save() {
    setSubmitError(null);
    if (!article) return;

    const patch: Parameters<typeof update.mutateAsync>[0]["patch"] = {};
    if (title !== article.title) patch.title = title.trim();
    if (summary !== (article.summary ?? "")) {
      patch.summary = summary.trim() === "" ? null : summary.trim();
    }
    if (contentMd !== (article.currentVersion?.contentMd ?? "")) {
      patch.contentMd = contentMd;
      patch.isMajor = isMajor;
    }
    if (categoryId !== (article.categoryId ?? "")) {
      patch.categoryId = categoryId === "" ? null : categoryId;
    }
    if (tagsChanged) {
      patch.tagSlugs = tagSlugs;
    }

    if (Object.keys(patch).length === 0) return;

    try {
      const updated = await update.mutateAsync({ id: article.id, patch });
      router.push(`/articles/${updated.slug}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.problem.detail || err.problem.title);
      } else {
        setSubmitError("Failed to save changes.");
      }
    }
  }

  const saveState: "idle" | "saving" | "saved" = update.isPending
    ? "saving"
    : update.isSuccess
      ? "saved"
      : "idle";

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-[52px] z-20 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-6 py-2 backdrop-blur md:px-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild aria-label="Back">
            <Link href={`/articles/${article.slug}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SaveStatus state={saveState} dirty={dirty} />
            <span className="text-muted-foreground/40">·</span>
            <span>
              Editing <span className="text-foreground">v{article.currentVersion?.versionNo ?? 1}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {submitError && (
            <span className="text-[11px] text-destructive">{submitError}</span>
          )}
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={isMajor}
              onChange={(e) => setIsMajor(e.target.checked)}
              className="size-3 accent-primary"
            />
            Major revision
          </label>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/articles/${article.slug}`}>Cancel</Link>
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit || !dirty || update.isPending}
            onClick={save}
          >
            {update.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save changes
            <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">
              ⌘S
            </Kbd>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[760px] px-6 py-12">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled article"
          className="w-full bg-transparent text-3xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none md:text-[34px]"
        />
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="Add a one-sentence summary your teammates can scan…"
          className="mt-3 w-full resize-none bg-transparent text-sm leading-relaxed text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />

        <div className="mt-6 flex items-center gap-3">
          <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-7 border border-border bg-background px-2 text-xs text-foreground focus:border-ring/60 focus:outline-none"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6">
          <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Tags
          </label>
          <div className="mt-2">
            <TagPicker value={tagSlugs} onChange={setTagSlugs} />
          </div>
        </div>

        <div className="mt-8">
          <MarkdownEditor
            value={contentMd}
            onChange={setContentMd}
            placeholder="# Write your article in Markdown…"
            minHeight={540}
          />
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Markdown is sanitized and rendered on the server.
          {dirty && " · Unsaved changes."}
        </p>
      </div>
    </div>
  );
}

function SaveStatus({
  state,
  dirty,
}: {
  state: "idle" | "saving" | "saved";
  dirty: boolean;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3 animate-spin text-amber-500" />
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
  return (
    <span className="text-muted-foreground">
      {dirty ? "Unsaved changes" : "Up to date"}
    </span>
  );
}
